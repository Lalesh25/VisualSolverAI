import subprocess, shlex

def interpret_and_solve(text: str, shapes: dict) -> str:
    prompt = f"""You are VisionSolver AI.
The user provided the following extracted text and detected geometry data:
---TEXT---
{text}
---SHAPES---
{shapes}

If this represents a math or physics problem (units like m, s, km/h, etc., or phrases like distance, speed, find time),
parse numeric values and relationships, form the necessary equations, and solve them step-by-step.
If you cannot parse any concrete problem, give a helpful suggestion about how to draw or label the diagram to get a solution.
Keep the answer concise and compute numeric answers when possible.
"""
    try:
        # call ollama if available locally
        cmd = ['ollama', 'run', 'llama3', prompt]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
        # fallback to echoing structured info
        return f'LLM did not respond. Extracted text:\n{text}\nDetected shapes: {shapes}'
    except FileNotFoundError:
        return f'Ollama not found locally. Extracted text:\n{text}\nDetected shapes: {shapes}'
    except Exception as e:
        return f'Error invoking local LLM: {e}'
