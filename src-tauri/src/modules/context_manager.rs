use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactBoundary {
    pub timestamp: u64,
    pub summary: String,
    pub actions_taken: Vec<String>,
    pub files_accessed: Vec<String>,
    pub decisions: Vec<String>,
    pub unfinished_tasks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub session_id: String,
    pub messages: VecDeque<Message>,
    pub compact_history: Vec<CompactBoundary>,
    pub total_tokens: usize,
    pub context_limit: usize,
}

impl SessionState {
    pub fn new(session_id: String, context_limit: usize) -> Self {
        Self {
            session_id,
            messages: VecDeque::new(),
            compact_history: Vec::new(),
            total_tokens: 0,
            context_limit,
        }
    }

    pub fn add_message(&mut self, role: String, content: String) {
        let tokens = content.len() / 4;
        self.total_tokens += tokens;
        self.messages.push_back(Message { role, content });
    }

    pub fn should_compact(&self) -> bool {
        self.total_tokens >= self.context_limit * 80 / 100
    }

    pub fn get_preserved_tail(&self) -> Vec<Message> {
        let tail_size = 10.min(self.messages.len());
        self.messages
            .iter()
            .rev()
            .take(tail_size)
            .cloned()
            .collect()
    }

    pub fn create_compact_boundary(
        &self,
        actions: Vec<String>,
        files: Vec<String>,
        decisions: Vec<String>,
        unfinished: Vec<String>,
    ) -> CompactBoundary {
        CompactBoundary {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            summary: format!(
                "Session {} - {} messages, {} tokens. Actions: {} files: {} decisions: {}",
                self.session_id,
                self.messages.len(),
                self.total_tokens,
                actions.len(),
                files.len(),
                decisions.len()
            ),
            actions_taken: actions,
            files_accessed: files,
            decisions,
            unfinished_tasks: unfinished,
        }
    }

    pub fn compact(&mut self) -> String {
        if !self.should_compact() {
            return String::new();
        }

        let tail = self.get_preserved_tail();

        let boundary = self.create_compact_boundary(
            vec!["Previous actions summarized".to_string()],
            vec!["Previous files accessed summarized".to_string()],
            vec!["Previous decisions summarized".to_string()],
            vec!["Previous unfinished tasks summarized".to_string()],
        );

        let summary = format!(
            "=== Session Compact ===\n\
             Previous context: {} messages ({} tokens)\n\
             Summary: {}\n\
             === End Compact ===",
            self.messages.len(),
            self.total_tokens,
            boundary.summary
        );

        self.compact_history.push(boundary);

        self.messages.clear();
        for msg in tail.into_iter().rev() {
            self.messages.push_front(msg);
        }

        self.total_tokens = self.messages.iter().map(|m| m.content.len() / 4).sum();

        summary
    }

    pub fn get_context_for_model(&self) -> Vec<Message> {
        let mut result = Vec::new();

        for boundary in &self.compact_history {
            result.push(Message {
                role: "system".to_string(),
                content: format!(
                    "[COMPACT] {} - Actions: {}",
                    boundary.summary,
                    boundary.actions_taken.join(", ")
                ),
            });
        }

        result.extend(self.messages.iter().cloned());

        result
    }

    pub fn estimate_tokens(&self) -> usize {
        self.messages
            .iter()
            .map(|m| m.content.len() / 4)
            .sum::<usize>()
            + self
                .compact_history
                .iter()
                .map(|b| b.summary.len() / 4)
                .sum::<usize>()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextManager {
    sessions: std::collections::HashMap<String, SessionState>,
    default_context_limit: usize,
}

impl ContextManager {
    pub fn new(default_limit: usize) -> Self {
        Self {
            sessions: std::collections::HashMap::new(),
            default_context_limit: default_limit,
        }
    }

    pub fn create_session(&mut self, session_id: String) {
        self.sessions.insert(
            session_id.clone(),
            SessionState::new(session_id, self.default_context_limit),
        );
    }

    pub fn add_message(&mut self, session_id: &str, role: String, content: String) {
        if let Some(session) = self.sessions.get_mut(session_id) {
            session.add_message(role, content);
        }
    }

    pub fn maybe_compact(&mut self, session_id: &str) -> Option<String> {
        if let Some(session) = self.sessions.get_mut(session_id) {
            if session.should_compact() {
                return Some(session.compact());
            }
        }
        None
    }

    pub fn get_context(&self, session_id: &str) -> Vec<Message> {
        self.sessions
            .get(session_id)
            .map(|s| s.get_context_for_model())
            .unwrap_or_default()
    }

    pub fn get_usage(&self, session_id: &str) -> (usize, usize) {
        self.sessions
            .get(session_id)
            .map(|s| (s.estimate_tokens(), s.context_limit))
            .unwrap_or((0, self.default_context_limit))
    }

    pub fn get_session_state(&self, session_id: &str) -> Option<SessionState> {
        self.sessions.get(session_id).cloned()
    }

    pub fn load_session_state(&mut self, session_id: String, state: SessionState) {
        self.sessions.insert(session_id, state);
    }

    pub fn remove_session(&mut self, session_id: &str) {
        self.sessions.remove(session_id);
    }

    pub fn session_exists(&self, session_id: &str) -> bool {
        self.sessions.contains_key(session_id)
    }
}

impl Default for ContextManager {
    fn default() -> Self {
        Self::new(64000)
    }
}
