# Whisper API

A lightweight FastAPI wrapper around [OpenAI Whisper](https://github.com/openai/whisper) for automatic speech recognition (ASR). Accepts audio file uploads and returns transcribed text.

## Prerequisites

| Dependency  | Version / Notes                                                                 |
|-------------|---------------------------------------------------------------------------------|
| Python      | 3.10 or later                                                                   |
| FFmpeg      | Required by Whisper for audio decoding. [Install guide](#installing-ffmpeg)     |
| CUDA        | Optional — accelerates inference on NVIDIA GPUs (recommended for large models)  |
| pip         | Latest version recommended                                                      |

### Installing FFmpeg

- **Windows:** `winget install FFmpeg` or download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH.
- **macOS:** `brew install ffmpeg`
- **Linux (Debian/Ubuntu):** `sudo apt install ffmpeg`
- **Linux (Fedora):** `sudo dnf install ffmpeg`

## Installation

```bash
pip install -r requirements.txt
```

## Running Locally

Start the FastAPI server on the default port (8000):

```bash
python main.py
```

The API is now available at **http://localhost:8000**.  
OpenAPI docs can be accessed at **http://localhost:8000/docs**.

### Environment Variables

| Variable        | Default      | Description                                         |
|-----------------|--------------|-----------------------------------------------------|
| `WHISPER_MODEL` | `base`       | Whisper model size (`tiny`, `base`, `small`, `medium`, `large`) |
| `PORT`          | `8000`       | Port the FastAPI server listens on                  |

Example:

```bash
export WHISPER_MODEL=medium  # Linux/Mac
$env:WHISPER_MODEL="medium"  # Windows PowerShell
python main.py
```

## Exposing via Tunnel

To make the API accessible from the internet (e.g., for use with a Next.js frontend), use a Cloudflare Tunnel.

### Windows

```powershell
.\start-tunnel.ps1
```

### Linux / macOS

```bash
chmod +x start-tunnel.sh
./start-tunnel.sh
```

Both scripts will:

1. Verify that `cloudflared` is installed (print install instructions if missing).
2. Start a Cloudflare Tunnel pointing at `http://localhost:8000`.
3. Print the public URL (look for `https://xxxxx.trycloudflare.com`).
4. Remain running until you press **Ctrl+C**.

### Connecting from Next.js

Copy the tunnel URL into your Next.js project's `.env.local` file:

```
WHISPER_API_URL=https://xxxxx.trycloudflare.com
```

Then use it in your API calls:

```typescript
const response = await fetch(`${process.env.WHISPER_API_URL}/transcribe`, {
  method: "POST",
  body: formData,
});
```

## Docker

Build the image:

```bash
docker build -t whisper-api .
```

Run the container (replace `medium` with your desired model):

```bash
docker run -d \
  --name whisper-api \
  -p 8000:8000 \
  -e WHISPER_MODEL=base \
  --gpus all \            # optional: enable GPU inference
  whisper-api
```

The API will be available at **http://localhost:8000**.

## API Reference

### `POST /transcribe`

Upload an audio file and receive a transcription.

**Request:** `multipart/form-data`
- `file` — Audio file (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, etc.)

**Response (200):**
```json
{
  "text": "transcribed text here"
}
```

### `GET /health`

Health check endpoint.

**Response (200):**
```json
{
  "status": "ok",
  "model": "base"
}
```

## Project Structure

```
whisper-api/
├── main.py               # FastAPI application entry point
├── requirements.txt      # Python dependencies
├── Dockerfile            # Container build instructions
├── start-tunnel.ps1      # Cloudflare tunnel launcher (Windows)
├── start-tunnel.sh       # Cloudflare tunnel launcher (Linux/Mac)
└── README.md             # This file
```

## License

Same as your parent project — see the project root `LICENSE` for details.
