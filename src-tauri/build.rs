fn main() {
    // 图标更新时重新生成 Windows EXE 资源和各平台原生图标。
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
