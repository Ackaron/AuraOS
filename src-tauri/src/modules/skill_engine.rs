use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub tags: Vec<String>,
    pub is_indexed: bool,
    pub source_url: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillContent {
    pub path: PathBuf,
    pub content: String,
    pub last_modified: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillManifest {
    pub name: String,
    pub version: String,
    pub description: String,
    pub tags: Vec<String>,
    pub author: Option<String>,
    pub repository: Option<String>,
    pub required_models: Option<Vec<String>>,
    pub tools: Option<Vec<String>>,
    pub mcp_config: Option<serde_json::Value>,
}

pub struct SkillEngine {
    skills_index: Arc<RwLock<HashMap<String, SkillMetadata>>>,
    content_cache: Arc<RwLock<HashMap<String, SkillContent>>>,
    skills_directory: PathBuf,
}

impl SkillEngine {
    pub fn new(skills_dir: PathBuf) -> Self {
        std::fs::create_dir_all(&skills_dir).ok();
        Self {
            skills_index: Arc::new(RwLock::new(HashMap::new())),
            content_cache: Arc::new(RwLock::new(HashMap::new())),
            skills_directory: skills_dir,
        }
    }

    pub fn get_skills_directory(&self) -> &PathBuf {
        &self.skills_directory
    }

    pub fn clone_skill(
        &self,
        github_url: &str,
        branch: Option<&str>,
    ) -> Result<SkillMetadata, String> {
        let url = github_url.trim_end_matches(".git");
        let repo_name = url.split('/').last().ok_or("Invalid GitHub URL")?;
        let skill_id = format!("skill_{}", repo_name.replace('-', "_"));
        let target_dir = self.skills_directory.join(&skill_id);

        if target_dir.exists() {
            return Err(format!(
                "Skill '{}' already exists at {:?}",
                repo_name, target_dir
            ));
        }

        let mut cmd = Command::new("git");
        cmd.arg("clone").arg("--depth").arg("1");

        if let Some(branch_name) = branch {
            cmd.arg("-b").arg(branch_name);
        }

        cmd.arg(github_url)
            .arg(&target_dir)
            .output()
            .map_err(|e| format!("Failed to execute git: {}", e))?;

        if !target_dir.exists() {
            return Err("Failed to clone repository".to_string());
        }

        let manifest = self.parse_skill_manifest(&target_dir);

        let metadata = SkillMetadata {
            id: skill_id.clone(),
            name: manifest
                .as_ref()
                .map(|m| m.name.clone())
                .unwrap_or_else(|| repo_name.to_string()),
            path: target_dir.clone(),
            tags: manifest
                .as_ref()
                .map(|m| m.tags.clone())
                .unwrap_or_default(),
            is_indexed: false,
            source_url: Some(github_url.to_string()),
            version: manifest.as_ref().map(|m| m.version.clone()),
        };

        self.index_skill(metadata.clone())?;
        self.index_skill_content(&skill_id, &target_dir)?;

        Ok(metadata)
    }

    fn parse_skill_manifest(&self, skill_path: &PathBuf) -> Option<SkillManifest> {
        let manifest_path = skill_path.join("skill.json");

        if let Ok(content) = std::fs::read_to_string(&manifest_path) {
            if let Ok(manifest) = serde_json::from_str::<SkillManifest>(&content) {
                return Some(manifest);
            }
        }

        let readme_path = skill_path.join("SKILL.md");
        if let Ok(content) = std::fs::read_to_string(&readme_path) {
            let tags = content
                .lines()
                .filter(|l| l.starts_with("#"))
                .take(5)
                .map(|l| l.trim_start_matches('#').trim().to_string())
                .collect();

            return Some(SkillManifest {
                name: skill_path.file_name()?.to_string_lossy().to_string(),
                version: "1.0.0".to_string(),
                description: "Skill from GitHub".to_string(),
                tags,
                author: None,
                repository: None,
                required_models: None,
                tools: None,
                mcp_config: None,
            });
        }

        None
    }

    fn index_skill_content(&self, skill_id: &str, skill_path: &PathBuf) -> Result<(), String> {
        let mut cache = self.content_cache.write().map_err(|e| e.to_string())?;

        if let Ok(entries) = std::fs::read_dir(skill_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        if ["md", "json", "ts", "js", "rs", "py"]
                            .contains(&ext.to_string_lossy().as_ref())
                        {
                            if let Ok(content) = std::fs::read_to_string(&path) {
                                let file_name = path
                                    .file_name()
                                    .map(|n| n.to_string_lossy().to_string())
                                    .unwrap_or_default();

                                cache.insert(
                                    format!("{}_{}", skill_id, file_name),
                                    SkillContent {
                                        path: path.clone(),
                                        content,
                                        last_modified: std::fs::metadata(&path)
                                            .ok()
                                            .and_then(|m| m.modified().ok())
                                            .map(|t| {
                                                t.duration_since(std::time::UNIX_EPOCH)
                                                    .unwrap_or_default()
                                                    .as_secs()
                                            })
                                            .unwrap_or(0),
                                    },
                                );
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    pub fn update_skill(&self, skill_id: &str) -> Result<SkillMetadata, String> {
        let index = self.skills_index.read().map_err(|e| e.to_string())?;
        let metadata = index.get(skill_id).cloned().ok_or("Skill not found")?;
        drop(index);

        let _repo_url = metadata.source_url.as_ref().ok_or("No source URL")?;
        let target_dir = &metadata.path;

        Command::new("git")
            .args(["-C", target_dir.to_str().unwrap_or(""), "pull"])
            .output()
            .map_err(|e| format!("Failed to update: {}", e))?;

        let manifest = self.parse_skill_manifest(target_dir);

        let mut updated = metadata.clone();
        if let Some(m) = manifest {
            updated.name = m.name;
            updated.tags = m.tags;
            updated.version = Some(m.version);
        }

        let mut index = self.skills_index.write().map_err(|e| e.to_string())?;
        index.insert(skill_id.to_string(), updated.clone());

        Ok(updated)
    }

    pub fn remove_skill(&self, id: &str) -> Result<bool, String> {
        let index = self.skills_index.read().map_err(|e| e.to_string())?;
        let metadata = index.get(id).cloned();

        if let Some(skill) = metadata {
            drop(index);

            if skill.path.exists() {
                std::fs::remove_dir_all(&skill.path).map_err(|e| e.to_string())?;
            }

            let mut idx = self.skills_index.write().map_err(|e| e.to_string())?;
            let removed = idx.remove(id).is_some();

            if removed {
                let mut cache = self.content_cache.write().map_err(|e| e.to_string())?;
                cache.retain(|k, _| !k.starts_with(id));
            }

            Ok(removed)
        } else {
            Ok(false)
        }
    }

    pub fn index_skill(&self, metadata: SkillMetadata) -> Result<(), String> {
        let mut index = self.skills_index.write().map_err(|e| e.to_string())?;
        index.insert(metadata.id.clone(), metadata);
        Ok(())
    }

    pub fn get_skills(&self) -> Result<Vec<SkillMetadata>, String> {
        let index = self.skills_index.read().map_err(|e| e.to_string())?;
        Ok(index.values().cloned().collect())
    }

    #[allow(dead_code)]
    pub fn get_skill(&self, id: &str) -> Result<Option<SkillMetadata>, String> {
        let index = self.skills_index.read().map_err(|e| e.to_string())?;
        Ok(index.get(id).cloned())
    }

    #[allow(dead_code)]
    pub fn cache_content(&self, skill_id: &str, content: SkillContent) -> Result<(), String> {
        let mut cache = self.content_cache.write().map_err(|e| e.to_string())?;
        cache.insert(skill_id.to_string(), content);
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_cached_content(&self, skill_id: &str) -> Result<Option<SkillContent>, String> {
        let cache = self.content_cache.read().map_err(|e| e.to_string())?;
        Ok(cache.get(skill_id).cloned())
    }

    #[allow(dead_code)]
    pub fn search_by_tag(&self, tag: &str) -> Result<Vec<SkillMetadata>, String> {
        let index = self.skills_index.read().map_err(|e| e.to_string())?;
        Ok(index
            .values()
            .filter(|s| s.tags.contains(&tag.to_string()))
            .cloned()
            .collect())
    }

    pub fn get_skill_content(&self, skill_id: &str) -> Result<Vec<SkillContent>, String> {
        let cache = self.content_cache.read().map_err(|e| e.to_string())?;
        Ok(cache
            .iter()
            .filter(|(k, _)| k.starts_with(skill_id))
            .map(|(_, v)| v.clone())
            .collect())
    }

    pub fn scan_local_skills(&self) -> Result<Vec<SkillMetadata>, String> {
        let mut results = Vec::new();

        if let Ok(entries) = std::fs::read_dir(&self.skills_directory) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(name) = path.file_name() {
                        let id = format!("skill_{}", name.to_string_lossy().replace('-', "_"));
                        let manifest = self.parse_skill_manifest(&path);

                        let metadata = SkillMetadata {
                            id: id.clone(),
                            name: manifest
                                .as_ref()
                                .map(|m| m.name.clone())
                                .unwrap_or_else(|| name.to_string_lossy().to_string()),
                            path: path.clone(),
                            tags: manifest
                                .as_ref()
                                .map(|m| m.tags.clone())
                                .unwrap_or_default(),
                            is_indexed: true,
                            source_url: None,
                            version: manifest.map(|m| m.version),
                        };

                        results.push(metadata.clone());
                        self.index_skill(metadata)?;
                        self.index_skill_content(&id.replace("skill_", ""), &path)?;
                    }
                }
            }
        }

        Ok(results)
    }
}
