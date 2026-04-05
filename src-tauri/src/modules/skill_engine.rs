use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub tags: Vec<String>,
    pub is_indexed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillContent {
    pub path: PathBuf,
    pub content: String,
    pub last_modified: u64,
}

pub struct SkillEngine {
    skills_index: Arc<RwLock<HashMap<String, SkillMetadata>>>,
    content_cache: Arc<RwLock<HashMap<String, SkillContent>>>,
    #[allow(dead_code)]
    watch_paths: Vec<PathBuf>,
}

impl SkillEngine {
    pub fn new() -> Self {
        Self {
            skills_index: Arc::new(RwLock::new(HashMap::new())),
            content_cache: Arc::new(RwLock::new(HashMap::new())),
            watch_paths: Vec::new(),
        }
    }

    #[allow(dead_code)]
    pub fn add_watch_path(&mut self, path: PathBuf) {
        self.watch_paths.push(path);
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

    pub fn remove_skill(&self, id: &str) -> Result<bool, String> {
        let mut index = self.skills_index.write().map_err(|e| e.to_string())?;
        let removed = index.remove(id).is_some();

        if removed {
            let mut cache = self.content_cache.write().map_err(|e| e.to_string())?;
            cache.remove(id);
        }

        Ok(removed)
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
}

impl Default for SkillEngine {
    fn default() -> Self {
        Self::new()
    }
}
