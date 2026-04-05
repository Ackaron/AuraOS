use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub id: i64,
    pub task_type: String,
    pub model_name: String,
    pub provider: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct SkillIndex {
    pub id: String,
    pub name: String,
    pub path: String,
    pub methods: serde_json::Value,
    pub is_active: bool,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaStatus {
    pub available: bool,
    pub models: Vec<OllamaModel>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub modified_at: Option<String>,
}

pub struct OllamaService {
    base_url: String,
}

impl OllamaService {
    pub fn new() -> Self {
        Self {
            base_url: "http://localhost:11434".to_string(),
        }
    }

    pub async fn check_status(&self) -> OllamaStatus {
        let client = reqwest::Client::new();
        
        match client.get(&format!("{}/api/tags", self.base_url)).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    match response.json::<serde_json::Value>().await {
                        Ok(json) => {
                            let models: Vec<OllamaModel> = json.get("models")
                                .and_then(|m| m.as_array())
                                .map(|arr| {
                                    arr.iter().filter_map(|m| {
                                        Some(OllamaModel {
                                            name: m.get("name")?.as_str()?.to_string(),
                                            size: m.get("size")?.as_u64()?,
                                            modified_at: m.get("modified_at").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                        })
                                    }).collect()
                                })
                                .unwrap_or_default();
                            
                            OllamaStatus {
                                available: true,
                                models,
                                error: None,
                            }
                        }
                        Err(e) => OllamaStatus {
                            available: false,
                            models: vec![],
                            error: Some(format!("Failed to parse response: {}", e)),
                        },
                    }
                } else {
                    OllamaStatus {
                        available: false,
                        models: vec![],
                        error: Some(format!("HTTP error: {}", response.status())),
                    }
                }
            }
            Err(e) => OllamaStatus {
                available: false,
                models: vec![],
                error: Some(format!("Connection failed: {}", e)),
            },
        }
    }

    pub async fn generate(&self, model: &str, prompt: &str) -> Result<String, String> {
        let client = reqwest::Client::new();
        
        let body = serde_json::json!({
            "model": model,
            "prompt": prompt,
            "stream": false
        });

        let response = client
            .post(&format!("{}/api/generate", self.base_url))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if response.status().is_success() {
            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Parse error: {}", e))?;
            
            Ok(json.get("response")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string())
        } else {
            Err(format!("HTTP error: {}", response.status()))
        }
    }

    pub async fn generate_streaming(
        &self,
        model: &str,
        prompt: &str,
        on_chunk: impl Fn(String) + Send + 'static,
    ) -> Result<String, String> {
        let client = reqwest::Client::new();
        
        let body = serde_json::json!({
            "model": model,
            "prompt": prompt,
            "stream": true
        });

        let response = client
            .post(&format!("{}/api/generate", self.base_url))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()));
        }

        let mut full_response = String::new();
        let mut stream = response.bytes_stream();
        
        use futures_util::StreamExt;
        while let Some(item) = stream.next().await {
            match item {
                Ok(bytes) => {
                    if let Ok(text) = String::from_utf8(bytes.to_vec()) {
                        for line in text.lines() {
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                                if let Some(chunk) = json.get("response").and_then(|v| v.as_str()) {
                                    on_chunk(chunk.to_string());
                                    full_response.push_str(chunk);
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    log::warn!("Stream error: {}", e);
                }
            }
        }
        
        Ok(full_response)
    }
}

impl Default for OllamaService {
    fn default() -> Self {
        Self::new()
    }
}

#[allow(dead_code)]
pub const INIT_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS ai_models_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL UNIQUE,
    model_name TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'ollama',
    parameters TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skill_core_index (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    methods TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_index (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    last_opened DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO ai_models_config (task_type, model_name, provider, parameters) VALUES
    ('logic', 'deepseek-r1:8b', 'ollama', '{"temperature": 0.7, "top_p": 0.9}'),
    ('code', 'qwen2.5:14b', 'ollama', '{"temperature": 0.3, "top_p": 0.95}'),
    ('docs', 'phi4:latest', 'ollama', '{"temperature": 0.5, "top_p": 0.9}'),
    ('fast', 'llama3.1:8b', 'ollama', '{"temperature": 0.2, "top_p": 0.85}');
"#;
