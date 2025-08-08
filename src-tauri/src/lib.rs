use dashu_float::DBig;
use rayon::prelude::*;
use serde::Serialize;
use std::str::FromStr;
use std::sync::Mutex;
use dashu_float::ops::EstimatedLog2;

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
  println!(
    "With values {} {} {}",
    app_state.pos.0, app_state.pos.1, app_state.zoom
  );

  let result = tauri::async_runtime::spawn_blocking(move || {
    let zoom = app_state.zoom;
    let precision = estimate_required_bits(&zoom, width);
    println!("Using {} bits of precision", precision);
    let max_iterations = app_state.max_iterations;

    let aspect_ratio: Float = Float::from(width).with_precision(precision).value()
      / Float::from(height).with_precision(precision).value();
    let view_height: Float = zoom.clone().with_precision(precision).value()
      * Float::from_str("2.0").unwrap().with_precision(precision).value();
    let view_width = view_height.clone() * aspect_ratio;

    let start_x = app_state.pos.0.clone().with_precision(precision).value()
      - &view_width / Float::from(2).with_precision(precision).value();
    let start_y = app_state.pos.1.clone().with_precision(precision).value()
      - &view_height / Float::from(2).with_precision(precision).value();

    let step_x = &view_width / Float::from(width).with_precision(precision).value();
    let step_y = &view_height / Float::from(height).with_precision(precision).value();

    println!("step_x: {}", step_x);
    println!("step_y: {}", step_y);

    let re_coords: Vec<Float> = (0..width)
      .map(|x| &start_x + &step_x * Float::from(x))
      .collect();
    let im_coords: Vec<Float> = (0..height)
      .map(|y| &start_y + &step_y * Float::from(y))
      .collect();

    let pixels: Vec<u8> = (0..(width * height))
      .into_par_iter()
      .flat_map(|i| {
        let x = i % width;
        let y = i / width;

        let re = &re_coords[x as usize];
        let im = &im_coords[y as usize];

        let mut zr = Float::ZERO.with_precision(precision).value();
        let mut zi = Float::ZERO.with_precision(precision).value();
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
fn set_max_iterations(
  state: tauri::State<'_, Mutex<AppState>>,
  max_iterations: u32,
) -> Result<(), String> {
  let mut app_state = state.lock().unwrap();
  app_state.max_iterations = max_iterations;
  println!("Updated iterations to {}", app_state.max_iterations);
  Ok(())
}

#[tauri::command]
fn get_pos_re(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
  Ok(state.lock().unwrap().pos.0.to_string())
}

#[tauri::command]
fn get_pos_im(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
  Ok(state.lock().unwrap().pos.1.to_string())
}

#[tauri::command]
fn get_zoom(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
  Ok(state.lock().unwrap().zoom.to_string())
}

#[tauri::command]
fn get_max_iterations(state: tauri::State<'_, Mutex<AppState>>) -> Result<u32, String> {
  Ok(state.lock().unwrap().max_iterations)
}

fn estimate_required_bits(zoom: &Float, width: u32) -> usize {
  let two = DBig::from(2);
  let inv_step = &DBig::from(width) / (&two * zoom);
  let repr = inv_step.repr();
  let log2 = repr.log2_est();
  let bits = log2.ceil() as usize;
  bits.clamp(128, 4096)
}

#[tauri::command]
fn zoom_into_box(
  state: tauri::State<'_, Mutex<AppState>>,
  x_pixel: u32,
  y_pixel: u32,
  size: u32,
) -> Result<(), String> {
  let mut app_state = state.lock().unwrap();

  let canvas_size = DBig::from(500u32);
  let x_mult = DBig::from(x_pixel) / &canvas_size;
  let y_mult = DBig::from(y_pixel) / &canvas_size;

  let view_height = &app_state.zoom * DBig::from_str("2.0").unwrap();
  let view_width = view_height.clone();

  let start_x = &app_state.pos.0 - &view_width / DBig::from(2);
  let start_y = &app_state.pos.1 - &view_height / DBig::from(2);

  let rel_x = DBig::from_str(&x_mult.to_string()).unwrap();
  let rel_y = DBig::from_str(&y_mult.to_string()).unwrap();

  let new_re = &start_x + &view_width * rel_x;
  let new_im = &start_y + &view_height * rel_y;

  let zoom_factor = DBig::from_str(&size.to_string()).unwrap() / canvas_size;
  app_state.pos = (new_re, new_im);
  app_state.zoom = &app_state.zoom * zoom_factor;

  println!(
    "Zoom box: x_mult={x_mult}, y_mult={y_mult}, size={size} -> new_zoom = {}",
    app_state.zoom
  );

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app_state = AppState {
    set: Set::Mandelbrot,
    pos: (Float::from_str("-0.6").unwrap(), Float::ZERO),
    max_iterations: 100,
    zoom: Float::from_str("1.65").unwrap(),
  };

  tauri::Builder::default()
    .manage(Mutex::new(app_state))
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      render_frame,
      set_pos_re,
      set_pos_im,
      set_zoom,
      set_max_iterations,
      zoom_into_box,
      get_zoom,
      get_pos_re,
      get_pos_im,
      get_max_iterations,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
