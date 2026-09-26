# qai-python

Python side of QAI. Runs in its own virtual environment, separate from the `qai-client` (Next.js) app. The first module installed is [AirLLM](https://github.com/lyogavin/airllm), which lets large language models run inference on limited GPU memory via layer-by-layer loading.

## Setup

```bash
cd qai-python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`requirements.txt` tracks top-level dependencies (starting with `airllm`). `requirements-lock.txt` is a full `pip freeze` snapshot of a known-working environment — use it for reproducible installs:

```bash
pip install -r requirements-lock.txt
```

## Layout

- `src/qai_python/` — project package; add new Python modules here.
- `examples/quickstart.py` — minimal AirLLM inference example (requires a CUDA GPU).
- `requirements.txt` / `requirements-lock.txt` — dependencies.
- `pyproject.toml` — package metadata, editable install support (`pip install -e .`).

## Notes

- `airllm` pulls in `torch`, `transformers`, and CUDA libraries; the environment is a few GB.
- Model weights are downloaded on first use via Hugging Face Hub and cached outside the repo (see `.gitignore`).
- Running `examples/quickstart.py` requires a CUDA-capable GPU (`.cuda()` calls in the example).
