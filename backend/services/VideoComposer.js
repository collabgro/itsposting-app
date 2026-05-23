const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const os = require('os');
const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;

ffmpeg.setFfmpegPath(ffmpegPath);

// ─── Dimension helpers ────────────────────────────────────────────────────────

const ASPECT_DIMS = {
  '9:16':  { '720p': [720,  1280], '1080p': [1080, 1920] },
  '16:9':  { '720p': [1280, 720],  '1080p': [1920, 1080] },
  '1:1':   { '720p': [720,  720],  '1080p': [1080, 1080] },
  '4:5':   { '720p': [720,  900],  '1080p': [1080, 1350] },
};

function getDims(aspectRatio, quality) {
  return (ASPECT_DIMS[aspectRatio] || ASPECT_DIMS['9:16'])[quality] || [720, 1280];
}

// ─── File download ────────────────────────────────────────────────────────────

async function downloadFile(url, destPath) {
  const resp = await axios.get(url, { responseType: 'stream', timeout: 120000 });
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    resp.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// ─── FFmpeg promise wrapper ───────────────────────────────────────────────────

function runFFmpeg(cmd) {
  return new Promise((resolve, reject) => {
    cmd.on('end', resolve).on('error', reject).run();
  });
}

// ─── Per-clip processing ──────────────────────────────────────────────────────

async function processVideoClip(clip, inputPath, outputPath, vW, vH) {
  const trimStart = clip.trimStart || 0;
  const trimEnd = clip.trimEnd || null;
  const speed = clip.speed || 1;
  const { brightness = 0, contrast = 0, saturation = 0 } = clip.filters || {};

  // eq filter: brightness -1..1 (ffmpeg needs -1..1), contrast 0..2 (normalize from -100..100)
  const ffBrightness = Math.max(-1, Math.min(1, brightness));
  const ffContrast = Math.max(0, Math.min(2, 1 + contrast / 100));
  const ffSaturation = Math.max(0, Math.min(3, 1 + saturation));

  const setpts = speed !== 1 ? `setpts=PTS/${speed},` : '';
  const eqFilter = `eq=brightness=${ffBrightness}:contrast=${ffContrast}:saturation=${ffSaturation}`;
  const scaleFilter = `scale=${vW}:${vH}:force_original_aspect_ratio=decrease,pad=${vW}:${vH}:(ow-iw)/2:(oh-ih)/2`;
  const videoFilters = `${setpts}${scaleFilter},${eqFilter}`;

  let cmd = ffmpeg(inputPath).outputOptions('-y');
  if (trimStart > 0) cmd = cmd.inputOptions(`-ss ${trimStart}`);
  if (trimEnd != null) cmd = cmd.inputOptions(`-to ${trimEnd}`);

  cmd = cmd.videoFilter(videoFilters).audioFilter(`atempo=${speed}`);

  if (clip.volume != null && clip.volume !== 1) {
    cmd = cmd.audioFilter(`volume=${clip.volume}`);
  }

  cmd = cmd.outputOptions(['-c:v libx264', '-c:a aac', '-preset fast', '-crf 23'])
    .output(outputPath);

  await runFFmpeg(cmd);
}

async function processImageClip(clip, inputPath, outputPath, vW, vH) {
  const duration = clip.duration || 3;
  const { brightness = 0, contrast = 0, saturation = 0 } = clip.filters || {};

  const ffBrightness = Math.max(-1, Math.min(1, brightness));
  const ffContrast = Math.max(0, Math.min(2, 1 + contrast / 100));
  const ffSaturation = Math.max(0, Math.min(3, 1 + saturation));

  const scaleFilter = `scale=${vW}:${vH}:force_original_aspect_ratio=decrease,pad=${vW}:${vH}:(ow-iw)/2:(oh-ih)/2`;
  const eqFilter = `eq=brightness=${ffBrightness}:contrast=${ffContrast}:saturation=${ffSaturation}`;

  const cmd = ffmpeg()
    .input(inputPath).inputOptions(['-loop 1', '-framerate 30'])
    .outputOptions('-y')
    .videoFilter(`${scaleFilter},${eqFilter}`)
    .outputOptions([
      `-t ${duration}`,
      '-c:v libx264', '-preset fast', '-crf 23',
      '-pix_fmt yuv420p', '-an',
    ])
    .output(outputPath);

  await runFFmpeg(cmd);
}

async function processColorClip(clip, outputPath, vW, vH) {
  const duration = clip.duration || 3;
  const color = (clip.color || '#000000').replace('#', '');
  const cmd = ffmpeg()
    .input(`color=c=${color}:size=${vW}x${vH}:rate=30`)
    .inputOptions('-f lavfi')
    .outputOptions('-y')
    .outputOptions([`-t ${duration}`, '-c:v libx264', '-preset fast', '-pix_fmt yuv420p', '-an'])
    .output(outputPath);
  await runFFmpeg(cmd);
}

// ─── Text overlay PNG generation ──────────────────────────────────────────────

async function buildTextPng(el, vW, vH, pngPath) {
  const x = Math.round((el.xPercent / 100) * vW);
  const y = Math.round((el.yPercent / 100) * vH);
  const fontSize = el.fontSize || 60;
  const fill = el.fill || '#ffffff';
  const fontFamily = (el.fontFamily || 'sans-serif').replace(/[<>&'"]/g, '');
  const textContent = String(el.text || '').replace(/[<>&'"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])
  );
  const fontWeight = (el.fontStyle || '').includes('bold') ? 'bold' : 'normal';
  const fontStyle = (el.fontStyle || '').includes('italic') ? 'italic' : 'normal';

  let bgRect = '';
  if (el.bgColor) {
    const op = el.bgOpacity != null ? el.bgOpacity : 0.6;
    const pad = Math.round(fontSize * 0.4);
    bgRect = `<rect x="${x - pad}" y="${y - fontSize - pad/2}" width="${vW * 0.8}" height="${fontSize + pad * 1.5}" rx="8"
      fill="${el.bgColor}" fill-opacity="${op}" />`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vW}" height="${vH}">
    ${bgRect}
    <text x="${x}" y="${y}"
      font-family="${fontFamily}, sans-serif"
      font-size="${fontSize}"
      font-weight="${fontWeight}"
      font-style="${fontStyle}"
      fill="${fill}"
      text-anchor="middle"
      dominant-baseline="auto"
    >${textContent}</text>
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(pngPath);
}

// ─── Apply text overlays to a video file ──────────────────────────────────────

async function applyTextOverlays(inputPath, textElements, vW, vH, tmpDir, outputPath) {
  if (!textElements || textElements.length === 0) {
    fs.copyFileSync(inputPath, outputPath);
    return;
  }

  // Build one PNG per text element
  const pngPaths = [];
  for (let i = 0; i < textElements.length; i++) {
    const pngPath = path.join(tmpDir, `text_${i}.png`);
    await buildTextPng(textElements[i], vW, vH, pngPath);
    pngPaths.push(pngPath);
  }

  // Build filter_complex string
  // Each PNG overlays the video, enabled only within startTime..endTime
  let filterParts = [];
  let inputs = [inputPath];
  let lastLabel = '0:v';

  for (let i = 0; i < textElements.length; i++) {
    const el = textElements[i];
    const st = el.startTime || 0;
    const et = el.endTime || 999;
    inputs.push(pngPaths[i]);
    const outLabel = `v${i + 1}`;
    filterParts.push(
      `[${lastLabel}][${i + 1}:v]overlay=0:0:enable='between(t,${st},${et})'[${outLabel}]`
    );
    lastLabel = outLabel;
  }

  const cmd = ffmpeg();
  inputs.forEach(f => cmd.input(f));
  cmd
    .outputOptions('-y')
    .complexFilter(filterParts)
    .outputOptions([`-map [${lastLabel}]`, '-map 0:a?', '-c:v libx264', '-c:a copy', '-preset fast'])
    .output(outputPath);

  await runFFmpeg(cmd);
}

// ─── Concatenate clips (with xfade transitions) ───────────────────────────────

async function concatenateClips(processedPaths, clips, tmpDir, outputPath) {
  if (processedPaths.length === 1) {
    fs.copyFileSync(processedPaths[0], outputPath);
    return;
  }

  // Check if any clip has a transition — use xfade
  const hasTransitions = clips.slice(1).some(c => c.transitionIn?.type && c.transitionIn.type !== 'none');

  if (!hasTransitions) {
    // Simple concat demuxer
    const concatFile = path.join(tmpDir, 'concat.txt');
    const lines = processedPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatFile, lines);
    const cmd = ffmpeg()
      .input(concatFile).inputOptions('-f concat -safe 0')
      .outputOptions('-y')
      .outputOptions(['-c:v libx264', '-c:a aac', '-preset fast'])
      .output(outputPath);
    await runFFmpeg(cmd);
    return;
  }

  // xfade transitions — chain them
  // Build filter_complex for all clips
  const inputs = [...processedPaths];
  const filterParts = [];
  let offset = 0;
  let prevLabel = '0:v';

  for (let i = 1; i < inputs.length; i++) {
    const clip = clips[i];
    const transition = clip.transitionIn || { type: 'none', duration: 0.5 };
    const prevClipDuration = clips[i - 1].duration || 5;
    offset += prevClipDuration - (transition.duration || 0.5);

    const xfadeType = transition.type === 'dissolve' ? 'dissolve'
      : transition.type === 'slide_left' ? 'slideleft'
      : 'fade';
    const outLabel = `xf${i}`;
    filterParts.push(
      `[${prevLabel}][${i}:v]xfade=transition=${xfadeType}:duration=${transition.duration || 0.5}:offset=${offset.toFixed(3)}[${outLabel}]`
    );
    prevLabel = outLabel;
  }

  const cmd = ffmpeg();
  inputs.forEach(p => cmd.input(p));
  cmd
    .outputOptions('-y')
    .complexFilter(filterParts)
    .outputOptions([`-map [${prevLabel}]`, '-c:v libx264', '-preset fast', '-crf 23', '-an'])
    .output(outputPath);

  await runFFmpeg(cmd);
}

// ─── Mix audio tracks ─────────────────────────────────────────────────────────

async function mixAudioTracks(videoPath, audioTracks, totalDuration, tmpDir, outputPath) {
  if (!audioTracks || audioTracks.length === 0) {
    fs.copyFileSync(videoPath, outputPath);
    return;
  }

  // Download audio files
  const audioPaths = [];
  for (let i = 0; i < audioTracks.length; i++) {
    const ext = audioTracks[i].sourceUrl.includes('.mp3') ? 'mp3' : 'm4a';
    const audioPath = path.join(tmpDir, `audio_${i}.${ext}`);
    await downloadFile(audioTracks[i].sourceUrl, audioPath);
    audioPaths.push(audioPath);
  }

  const cmd = ffmpeg().input(videoPath);
  audioPaths.forEach(p => cmd.input(p));

  // Build amix filter
  const numAudio = audioPaths.length;
  const weights = ['1', ...audioTracks.map(a => String(a.volume || 0.5))].join(' ');
  const amixFilter = `[0:a]${audioPaths.map((_, i) => `[${i + 1}:a]`).join('')}amix=inputs=${numAudio + 1}:duration=first:weights=${weights}[aout]`;

  cmd
    .outputOptions('-y')
    .complexFilter([amixFilter])
    .outputOptions(['-map 0:v', '-map [aout]', '-c:v copy', '-c:a aac', '-shortest'])
    .output(outputPath);

  await runFFmpeg(cmd);
}

// ─── Cloudinary upload ────────────────────────────────────────────────────────

async function uploadVideoToCloudinary(filePath, customerId) {
  const publicId = `itsposting/studio/videos/${customerId}/${Date.now()}`;
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: 'video',
    public_id: publicId,
    overwrite: true,
  });
  return result.secure_url;
}

// ─── Main render function ─────────────────────────────────────────────────────

async function renderVideo(project, customerId, quality = '720p') {
  const tmpDir = path.join(os.tmpdir(), `itsposting_${Date.now()}_${customerId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const [vW, vH] = getDims(project.aspectRatio || '9:16', quality);
    const clips = project.clips || [];
    const textElements = project.textElements || [];
    const audioTracks = project.audioTracks || [];

    if (clips.length === 0) throw new Error('No clips in project');

    // Step 1: Download + process each clip
    const processedPaths = [];
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const ext = clip.type === 'image' ? 'jpg' : 'mp4';
      const dlPath = path.join(tmpDir, `dl_${i}.${ext}`);
      const procPath = path.join(tmpDir, `proc_${i}.mp4`);

      if (clip.type === 'color') {
        await processColorClip(clip, procPath, vW, vH);
      } else {
        await downloadFile(clip.sourceUrl, dlPath);
        if (clip.type === 'image') {
          await processImageClip(clip, dlPath, procPath, vW, vH);
        } else {
          await processVideoClip(clip, dlPath, procPath, vW, vH);
        }
      }
      processedPaths.push(procPath);
    }

    // Step 2: Concatenate
    const concatPath = path.join(tmpDir, 'concat.mp4');
    await concatenateClips(processedPaths, clips, tmpDir, concatPath);

    // Step 3: Apply text overlays
    const textPath = path.join(tmpDir, 'text.mp4');
    await applyTextOverlays(concatPath, textElements, vW, vH, tmpDir, textPath);

    // Step 4: Mix audio
    const totalDuration = clips.reduce((sum, c) => sum + (c.duration || 0), 0);
    const finalPath = path.join(tmpDir, 'final.mp4');
    await mixAudioTracks(textPath, audioTracks, totalDuration, tmpDir, finalPath);

    // Step 5: Upload to Cloudinary
    const url = await uploadVideoToCloudinary(finalPath, customerId);
    return url;

  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = { renderVideo };
