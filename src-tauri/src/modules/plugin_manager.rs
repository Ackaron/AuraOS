use std::fs;
use std::path::{Path, PathBuf};
use std::io::Cursor;
use tauri::{AppHandle, Emitter};
use std::env;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct PluginInstallResult {
    pub success: bool,
    pub message: String,
    pub path: Option<String>,
}

pub async fn download_and_extract_plugin(
    app: AppHandle,
    github_url: String,
) -> Result<PluginInstallResult, String> {
    // Parse github URL. E.g. https://github.com/kepano/obsidian-skills
    let url = github_url.trim_end_matches('/');
    let parts: Vec<&str> = url.split('/').collect();
    if parts.len() < 5 || parts[2] != "github.com" {
        return Err("Invalid GitHub URL. Must be in format https://github.com/user/repo".into());
    }
    
    let user = parts[3];
    let repo = parts[4];
    
    // Default to main branch, we can improve this later to fetch default branch via GitHub API
    let mut zip_url = format!("https://github.com/{}/{}/archive/refs/heads/main.zip", user, repo);
    
    // Create library/skills directory if it doesn't exist
    let current_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let library_path = current_dir.join("library").join("skills");
    if !library_path.exists() {
        fs::create_dir_all(&library_path).map_err(|e| format!("Failed to create library folder: {}", e))?;
    }
    
    // Emit event to frontend
    let _ = app.emit("plugin-download-status", format!("Downloading {}/{}...", user, repo));

    // Request the ZIP
    let client = reqwest::Client::new();
    let mut response = client.get(&zip_url)
        .header("User-Agent", "AuraOS-Plugin-Manager")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    // Fallback to master if main doesn't exist (404)
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        zip_url = format!("https://github.com/{}/{}/archive/refs/heads/master.zip", user, repo);
        response = client.get(&zip_url)
            .header("User-Agent", "AuraOS-Plugin-Manager")
            .send()
            .await
            .map_err(|e| e.to_string())?;
    }
    
    if !response.status().is_success() {
        return Err(format!("Failed to download plugin. Status: {}", response.status()));
    }
    
    let _ = app.emit("plugin-download-status", "Extracting plugin archive...".to_string());
    
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let cursor = Cursor::new(bytes);
    
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("Failed to read zip: {}", e))?;
    
    let target_dir_name = format!("{}-{}", user, repo);
    let target_path = library_path.join(&target_dir_name);
    
    if target_path.exists() {
        // Clear old version
        fs::remove_dir_all(&target_path).map_err(|e| format!("Failed to clear old plugin folder: {}", e))?;
    }
    
    // Extract process
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("Zip error: {}", e))?;
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };
        
        // Strip the first component (the top-level folder in the zip like "repo-main")
        let mut components = outpath.components();
        components.next();
        let stripped_path = components.as_path();
        
        if stripped_path.as_os_str().is_empty() {
            continue;
        }
        
        let final_path = target_path.join(stripped_path);
        
        if file.name().ends_with('/') {
            fs::create_dir_all(&final_path).unwrap_or_default();
        } else {
            if let Some(p) = final_path.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).unwrap_or_default();
                }
            }
            let mut outfile = fs::File::create(&final_path).map_err(|e| format!("Failed to create file: {}", e))?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| format!("Failed to extract file: {}", e))?;
        }
    }
    
    let _ = app.emit("plugin-download-status", "Plugin installed successfully!".to_string());
    
    Ok(PluginInstallResult {
        success: true,
        message: format!("Successfully installed {}/{}", user, repo),
        path: Some(target_path.to_string_lossy().to_string()),
    })
}

pub fn remove_plugin(path: String) -> Result<(), String> {
    let folder_path = Path::new(&path);
    if folder_path.exists() && folder_path.is_dir() {
        fs::remove_dir_all(folder_path).map_err(|e| format!("Failed to delete plugin directory: {}", e))?;
    }
    Ok(())
}
