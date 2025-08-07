use std::sync::Mutex;
use serde::Serialize;
use dashu_float::{FBig, round::mode::HalfAway};
use rayon::prelude::*;

pub type Float = FBig<HalfAway>;

#[derive(Clone)]
enum Set {
  Mandelbrot,
}

#[derive(Clone)]
struct AppState {
  set: Set,
  pos: (Float, Float),
  max_iterations: u32,
  zoom: Float,
}

#[derive(Serialize)]
struct FrameData {
  width: u32,
  height: u32,
  pixels: Vec<u8>,
}

#[tauri::command]
async fn render_frame(
  state: tauri::State<'_, Mutex<AppState>>,
  width: u32,
  height: u32,
) -> Result<String, String> {
  let app_state = state.lock().unwrap().clone();

  let result = tauri::async_runtime::spawn_blocking(move || {
    let zoom = app_state.zoom;
    let max_iterations = app_state.max_iterations;

    let view_width = &zoom * Float::try_from(3.5).unwrap();
    let view_height = &zoom * Float::try_from(2.0).unwrap();

    let start_x = &app_state.pos.0 - &view_width / Float::from(2);
    let start_y = &app_state.pos.1 - &view_height / Float::from(2);

    let step_x = &view_width / Float::from(width);
    let step_y = &view_height / Float::from(height);

    let pixels: Vec<u8> = (0..(width * height))
      .into_par_iter()
      .flat_map(|i| {
        let x = i % width;
        let y = i / width;

        let re = &start_x + &step_x * Float::from(x);
        let im = &start_y + &step_y * Float::from(y);

        let mut zr = Float::from(0);
        let mut zi = Float::from(0);
        let mut i = 0;

        while i < max_iterations {
          let zr2 = &zr * &zr;
          let zi2 = &zi * &zi;

          if &zr2 + &zi2 > Float::from(4) {
            break;
          }

          let new_zi = Float::from(2) * &zr * &zi + &im;
          zr = &zr2 - &zi2 + &re;
          zi = new_zi;

          i += 1;
        }

        if i == max_iterations {
          vec![0, 0, 0, 255]
        } else {
          let v = (i * 255 / max_iterations) as u8;
          vec![v, v, 255, 255]
        }
      })
      .collect();

    let frame = FrameData {
      width,
      height,
      pixels,
    };

    serde_json::to_string(&frame).map_err(|e| e.to_string())
  })
    .await
    .map_err(|e| e.to_string())?;

  result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app_state = AppState {
    set: Set::Mandelbrot,
    pos: (Float::try_from(0.0).unwrap(), Float::try_from(0.0).unwrap()),
    max_iterations: 100,
    zoom: Float::try_from(1.0).unwrap(),
  };

  tauri::Builder::default()
    .manage(Mutex::new(app_state))
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![render_frame])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
