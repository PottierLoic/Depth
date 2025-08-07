use std::str::FromStr;
use std::sync::Mutex;
use serde::Serialize;
use dashu_float::{DBig, round::mode::HalfAway};
use rayon::prelude::*;

pub type Float = DBig;

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
  let four: Float = Float::from_str("4.0").unwrap();
  let two: Float = Float::from_str("2.0").unwrap();

  println!("Render started");
  println!("With values {} {} {}", app_state.pos.0, app_state.pos.1, app_state.zoom);

  let result = tauri::async_runtime::spawn_blocking(move || {
    let zoom = app_state.zoom;
    let max_iterations = app_state.max_iterations;

    let view_width = &zoom * Float::from_str("3.5").unwrap();
    let view_height = &zoom * Float::from_str("2.0").unwrap();

    let start_x = &app_state.pos.0 - &view_width / Float::from(2);
    let start_y = &app_state.pos.1 - &view_height / Float::from(2);

    let step_x = &view_width / Float::from(width);
    let step_y = &view_height / Float::from(height);

    let re_coords: Vec<Float> = (0..width).map(|x| &start_x + &step_x * Float::from(x)).collect();
    let im_coords: Vec<Float> = (0..height).map(|y| &start_y + &step_y * Float::from(y)).collect();

    let pixels: Vec<u8> = (0..(width * height))
      .into_par_iter()
      .flat_map(|i| {
        let x = i % width;
        let y = i / width;

        let re = &re_coords[x as usize];
        let im = &im_coords[y as usize];

        let mut zr = Float::ZERO;
        let mut zi = Float::ZERO;
        let mut i = 0;

        while i < max_iterations {
          let zr2 = &zr * &zr;
          let zi2 = &zi * &zi;

          if &zr2 + &zi2 > four {
            break;
          }

          let new_zi = &two * &zr * &zi + im;
          zr = &zr2 - &zi2 + re;
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
  println!("Render finished");
  result
}

#[tauri::command]
fn set_pos_re(state: tauri::State<'_, Mutex<AppState>>, pos_re: String) -> Result<(), String> {
  let mut app_state = state.lock().unwrap();
  app_state.pos.0 = DBig::from_str(&pos_re).unwrap();
  println!("Updated pos_re to {}", app_state.pos.0);
  Ok(())
}

#[tauri::command]
fn set_pos_im(state: tauri::State<'_, Mutex<AppState>>, pos_im: String) -> Result<(), String> {
  let mut app_state = state.lock().unwrap();
  app_state.pos.1 = DBig::from_str(&pos_im).unwrap();
  println!("Updated pos_im to {}", app_state.pos.1);
  Ok(())
}

#[tauri::command]
fn set_zoom(state: tauri::State<'_, Mutex<AppState>>, zoom: String) -> Result<(), String> {
  let mut app_state = state.lock().unwrap();
  app_state.zoom = DBig::from_str(&zoom).unwrap();
  println!("Updated zoom to {}", app_state.zoom);
  Ok(())
}

#[tauri::command]
fn set_max_iterations(state: tauri::State<'_, Mutex<AppState>>, max_iterations: u32) -> Result<(), String> {
  let mut app_state = state.lock().unwrap();
  app_state.max_iterations = max_iterations;
  println!("Updated iterations to {}", app_state.max_iterations);
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app_state = AppState {
    set: Set::Mandelbrot,
    pos: (Float::ZERO, Float::ZERO),
    max_iterations: 100,
    zoom: Float::ONE,
  };

  tauri::Builder::default()
    .manage(Mutex::new(app_state))
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![render_frame, set_pos_re, set_pos_im, set_zoom, set_max_iterations])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
