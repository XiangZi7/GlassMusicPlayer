use crate::tuneweave::kugou_public_search;
use serde::Serialize;
use serde_json::Value;
use tauri::WebviewWindow;

const INVALID: &str = "酷狗搜索结果不完整，无法确认要收藏的歌曲。";
const AMBIGUOUS: &str = "无法唯一确认这首酷狗歌曲对应的收藏编号。";
const MAX_RESULTS: u64 = 1_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HashPage {
    album_audio_id: Option<String>,
    next_offset: Option<u32>,
    total: u64,
}

// 酷狗目录使用 32 位十六进制文件 hash 标记同一份音频。
fn valid_hash(value: &str) -> bool {
    value.len() == 32 && value.bytes().all(|c| c.is_ascii_hexdigit())
}

// 核对公开目录的一页，在原曲的文件 hash 精确相同时才接受专辑曲目编号。
fn matching_page(body: &Value, hash: &str, offset: u32) -> Result<HashPage, String> {
    let items = body["data"].as_array().ok_or(INVALID)?;
    let page = &body["meta"]["pagination"];
    let total = page["total"].as_u64().ok_or(INVALID)?;
    if total > MAX_RESULTS {
        return Err(AMBIGUOUS.into());
    }
    if body["meta"]["platform"] != "kugou"
        || page["offset"].as_u64() != Some(u64::from(offset))
        || page["limit"].as_u64() != Some(30)
        || items.len() > 30
    {
        return Err(INVALID.into());
    }
    let consumed = u64::from(offset) + items.len() as u64;
    let has_more = page["has_more"].as_bool().ok_or(INVALID)?;
    if consumed > total || has_more != (consumed < total) {
        return Err(INVALID.into());
    }
    let next_offset = if has_more {
        if items.is_empty() || page["next_offset"].as_u64() != Some(consumed) {
            return Err(INVALID.into());
        }
        Some(consumed as u32)
    } else {
        if !page["next_offset"].is_null() {
            return Err(INVALID.into());
        }
        None
    };

    let mut candidate: Option<&str> = None;
    for item in items {
        let track = &item["data"];
        let id = track["id"].as_str().ok_or(INVALID)?;
        if item["type"] != "track"
            || track["platform"] != "kugou"
            || track["ref"] != format!("kugou:{id}")
        {
            return Err(INVALID.into());
        }
        let file_hash = track["extensions"]["hash"]
            .as_str()
            .filter(|value| valid_hash(value))
            .ok_or(INVALID)?;
        if !file_hash.eq_ignore_ascii_case(hash) {
            continue;
        }
        if track["extensions"]["album_audio_id"] != id
            || id.starts_with('0')
            || !id.bytes().all(|c| c.is_ascii_digit())
            || id.parse::<u64>().is_err()
            || candidate.is_some_and(|previous| previous != id)
        {
            return Err(AMBIGUOUS.into());
        }
        candidate = Some(id);
    }
    Ok(HashPage {
        album_audio_id: candidate.map(str::to_owned),
        next_offset,
        total,
    })
}

// 只向主窗口返回原始 hash 匹配的编号和继续位置，不需要账号凭据。
#[tauri::command]
pub async fn tuneweave_kugou_search_hash(
    window: WebviewWindow,
    query: String,
    hash: String,
    offset: u32,
) -> Result<HashPage, String> {
    if !valid_hash(&hash) {
        return Err("缺少有效的酷狗歌曲 hash。".into());
    }
    let body = kugou_public_search(&window, &query, offset).await?;
    matching_page(&body, &hash, offset)
}
