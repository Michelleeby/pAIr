# pAIr

Simple pair programming/chat assistant CLI and Web App powered by OpenAI (defaults to "gpt-4" model).

---

## Table of Contents

- [Requirements](#requirements)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage (CLI)](#usage-cli)
- [Usage (Web App)](#usage-web-app)
- [Training the Tokenizer](#training-the-tokenizer)
- [Thanks and Enjoy](#thanks-and-enjoy)

---

## Requirements

- [Python](https://www.python.org/) (12.2.0+ recommended)
- [OpenAI API key (free or paid)](https://platform.openai.com/api-keys)

---

## Features

- Chat with `gpt-4` in your terminal **or** browser
- Set the system prompt during the conversation
- Upload and inject file context (webapp only)
- Live Markdown preview as you type (webapp)
- Syntax highlighting and copy-to-clipboard for code blocks
- Download chat history as Markdown
- Start new chat sessions with confirmation and save prompts
- Train the BPE tokenizer with your own chat logs
- Markdown formatted chat responses

---

## Installation

### 1. Clone and Setup Python Environment

```bash
git clone https://github.com/Michelleeby/pAIr.git && cd pAIr
echo "12.2.0" > .python-version

if [ -d "pair" ]; then
    source pair/bin/activate
else
    python -m venv pair
    source pair/bin/activate
fi

pip install -r requirements.txt
```

### 2. Install Frontend Static Files (Webapp Only)

The webapp uses only static HTML/CSS/JS, so no build step or npm install is needed for basic use.

If you want to customize themes or bundle, see the `/static` folder.

---

## Configuration

pAIr uses environment variables (from `.env`) for configuration.

**Minimum required:**

```env
OPENAI_API_KEY=your-api-key-here
```

**All supported variables:**

```env
OPENAI_API_KEY=your-api-key-here
GPT_MODEL_NAME=gpt-4
MODEL_PATH=pair.pkl
TRAINING_DATA_PATH=sample-training-data.log
PAT_STR=('s|'t|'re|'ve|'m|'ll|'d| ?[\p{L}]+| ?[\p{N}]+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+)|(```[\s\S]*?```)|(`[^`]*`)|(\[[^\]]*\]\([^)]*\))
```

---

## Usage (CLI)

After setup, activate your environment:

```bash
source pair/bin/activate
```

Start the chat assistant:

```bash
python pair.py
```

Or add an alias in your `.bashrc` or `.zshrc`:

```bash
echo "alias pair='source $(pwd)/pair/bin/activate && python $(pwd)/pair.py && deactivate'" >> ~/.bashrc
source ~/.bashrc
```

### CLI Features

- Start chatting in the terminal with Markdown support
- Multiline message entry (press `Ctrl+D` to send)
- Type `quit` and press `Ctrl+D` to exit
- Responses formatted in Markdown for easy reading
- System prompt can be set/updated interactively (`set_system`)
- Chat history saved in `chat.log`

#### System Prompt (CLI only)

Type `set_system` and press `Ctrl+D`. You'll be prompted to append to/reset the default system message.

#### Default System Message

The system prompt makes the assistant always return fully Markdown formatted responses, with clear sections for code and explanations.

---

## Usage (Web App)

You can use the web app to access all the features of the CLI and more, via a modern browser interface.

### Starting the Web App

After setup, activate your environment and start the FastAPI backend:

```bash
uvicorn app:app --reload
```

Then open your browser and visit: [http://localhost:8000](http://localhost:8000)

### Web App Features

#### Interface Overview

- **Chat History:** Shows all messages in Markdown, with highlighted code
- **Live Preview:** Type your message in Markdown and see a live, rendered preview before sending
- **File Context:** Drag & drop or select multiple files to provide them as context to the assistant (files sent along with your message)
- **Download Chat:** Save the current chat history as a `.md` Markdown file with a click
- **Start New Chat:** Clears the chat and starts a new session, with save prompt if history not yet downloaded
- **Copy Buttons:** Easily copy any AI code block or full response with one click
- **Dark/Light Theme:** Automatically adapts to your OS preference

#### How to Chat

1. Type your message (supports Markdown, including code blocks)
2. Optionally, select/drag files to inject as context (assistant will prioritize your files for this reply)
3. Click **Send** or press `Enter`
4. Read the AI's response with formatting and code highlights

#### File Upload

- Drop any number of `.txt`, `.py`, `.md`, or similar files in the dropzone
- Remove files from the queue before sending if needed
- Files are sent with your next message

#### Chat History

- Download your conversation anytime as a clean, formatted Markdown file
- All user and assistant messages are saved (excluding system messages by default)

#### System Prompt

- The webapp applies the same system prompt as the CLI for each session
- Future updates may allow specifying/changing it interactively

#### Theme

- Switches between light/dark automatically, respecting your device/system preferences

---

## Training the Tokenizer

You can train your own tokenizer for more efficient message encoding and cost savings.

The code will default to training from the `sample-training-data.log` file provided. To use your own data, set the `TRAINING_DATA_PATH` variable in `.env`.

If the tokenizer model file (`MODEL_PATH`) doesn't exist, the system will train and save a new one on first run.

**Sample pattern (`PAT_STR`) is suitable for chat logs and Markdown code:**

```python
pat_str = r"""('s|'t|'re|'ve|'m|'ll|'d| ?[\p{L}]+| ?[\p{N}]+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+)|(```[\s\S]*?```)|(`[^`]*`)|(\[[^\]]*\]\([^)]*\))"""
```

---

## Thanks and Enjoy 🦾

pAIr is Open Source. Contributions, bug reports, and suggestions welcome!

For more, see:

- [GitHub pAIr Source](https://github.com/Michelleeby/pAIr)
- [OpenAI API](https://platform.openai.com/docs)

---

> Need help? [Open an Issue on GitHub](https://github.com/Michelleeby/pAIr/issues) or start chatting right away with pAIr! 🚀