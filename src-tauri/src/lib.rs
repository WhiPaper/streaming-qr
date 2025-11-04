use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_decoded_data(data: String, filename: Option<String>) -> Result<String, String> {
    let file_name = filename.unwrap_or_else(|| {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        format!("decoded_stream_{}.txt", timestamp)
    });
    
    fs::write(&file_name, data)
        .map_err(|e| format!("Failed to save file: {}", e))?;

    Ok(format!("Data saved to: {}", file_name))
}

#[tauri::command]
fn validate_data(data: &str) -> Result<serde_json::Value, String> {
    let size = data.len();
    let is_utf8 = std::str::from_utf8(data.as_bytes()).is_ok();
    let line_count = data.lines().count();
    let word_count = data.split_whitespace().count();
    
    Ok(serde_json::json!({
        "size": size,
        "is_utf8": is_utf8,
        "line_count": line_count,
        "word_count": word_count,
        "is_empty": data.is_empty()
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            save_decoded_data,
            validate_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
