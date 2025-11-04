#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{App, Manager};

#[tauri::command]
fn ping() -> &'static str {
  "pong"
}

fn setup_app(_app: &App) -> Result<(), Box<dyn std::error::Error>> {
  Ok(())
}

fn main() {
  tauri::Builder::default()
    .setup(setup_app)
    .invoke_handler(tauri::generate_handler![ping])
    .run(tauri::generate_context!())
    .expect("error while running streaming-qr app");
}
