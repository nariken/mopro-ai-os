#!/bin/zsh
set -euo pipefail

ROOT="${0:A:h}"
CAP="$ROOT/captures"
OUT="$ROOT/output"
TMP="$OUT/clips"
FONT="/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"

mkdir -p "$TMP"

images=(
  01-home.png
  02-explore.png
  03-catalog-marketing.png
  04-agent-seeded.png
  05-workspace.png
  06-connections.png
  07-context-skills.png
  08-outro.png
)
durations=(5 8 11 10 11 7 4 4)
captions=(
  $'生成AIを、相談相手から\n仕事を動かす仕組みへ。'
  $'目的に合わせたAIエージェントや業務アプリを\n対話しながら構築'
  $'8つの業務領域・25種類のエージェント\nカタログからすぐに開始'
  $'必要な役割と進め方を引き継ぎ\n専用ワークスペースを構築'
  $'回答だけで終わらず\n既存システムとつながり、継続的に実行'
  $'重要な操作は人が確認\n根拠と安全性を保って進める'
  $'業務知識とSkillを蓄積し\nエージェントが再利用'
  ''
)

for i in {1..8}; do
  idx=$(printf "%02d" "$i")
  image="${images[$i]}"
  duration="${durations[$i]}"
  frames=$((duration * 30))
  if [[ -n "${captions[$i]}" ]]; then
    magick "$CAP/$image" \
      -fill '#000000B0' -draw 'rectangle 0,590 1280,720' \
      -font "$FONT" -pointsize 30 -fill white -gravity south \
      -interline-spacing 8 -annotate +0+28 "${captions[$i]}" \
      "$TMP/$idx.png"
  else
    magick "$CAP/$image" "$TMP/$idx.png"
  fi
  ffmpeg -hide_banner -loglevel error -y \
    -loop 1 -i "$TMP/$idx.png" \
    -vf "zoompan=z='min(zoom+0.00028,1.028)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${frames}:s=2560x1440:fps=30,scale=1280:720:flags=lanczos,format=yuv420p" \
    -t "$duration" -an -c:v libx264 -preset medium -crf 18 "$TMP/$idx.mp4"
done

for i in {1..8}; do
  idx=$(printf "%02d" "$i")
  print -r -- "file '$TMP/$idx.mp4'"
done > "$TMP/concat.txt"

ffmpeg -hide_banner -loglevel error -y \
  -f concat -safe 0 -i "$TMP/concat.txt" \
  -c copy "$OUT/picture.mp4"

ffmpeg -hide_banner -loglevel error -y \
  -i "$OUT/picture.mp4" \
  -i "$OUT/narration-elevenlabs-v3.mp3" \
  -filter_complex "[1:a]adelay=900|900,apad=pad_dur=60,volume=0.95[a]" \
  -map 0:v -map "[a]" \
  -t 60 -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart \
  "$OUT/mopro-ai-os-internal-demo-v1.mp4"

ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height -of json \
  "$OUT/mopro-ai-os-internal-demo-v1.mp4"
