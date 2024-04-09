# pAIr

Simple pair programming/chat assistant CLI tool powered by openAI (defaults to "gpt-4" model).

## Requirements

- [Python](https://www.python.org/) (12.2.0+ recommended)
- [OpenAI API key (free or paid)](https://platform.openai.com/api-keys)

## Features

- Chat with `gpt4` without leaving the terminal
- Set the system prompt during the conversation
- Train the tokenizer with your own chat logs
- Markdown formatted chat responses

## Installation

Your going to need a working python version. This code was developed with 12.2.0. You can check your python version by running the following command:

```bash
python --version
```

Check out [pyenv](https://github.com/pyenv) if you need to manage multiple python versions.

If you want to quickly get set up with python 12.2.0, you can run something like the following:

```bash
curl https://pyenv.run | bash
echo 'export PATH="$HOME/.pyenv/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init --path)"' >> ~/.bashrc
echo 'eval "$(pyenv init -)"' >> ~/.bashrc
source ~/.bashrc
pyenv install 12.2.0
```

Next, you need to install the required dependencies. Its recommended to use a virtual environment. You can do this similar to:

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

## Adding an alias

You can add an alias to your `.bashrc` or `.zshrc` file to quickly start the chat assistant. As an example:

```bash
echo "alias pair='source $(pwd)/pair/bin/activate && python $(pwd)/pair.py && deactivate'" >> ~/.bashrc
source ~/.bashrc
```

Then simply type `pair` in your terminal to start the chat assistant.

## Configuration

You can configure the chat assistant by setting the following environment variables:

- `OPENAI_API_KEY`: Your openAI API key
- `GPT_MODEL_NAME`: The name of the model to use (default "gpt-4")
- `MODEL_PATH`: The path to the model file for the tokenizer
- `TRAINING_DATA_PATH`: The path to the chat log file for training the tokenizer
- `PAT_STR`: The pattern string for the tokenizer

## Usage

pAIr relies on environment variables for configuration. By design it will read from a `.env` file in the root of the project.

The only variable required to run is an openAI API key defined like:

```plaintext
OPENAI_API_KEY=your-api-key-here
```

Here is an example `.env` file that includes all the possible configuration options:

```plaintext
OPENAI_API_KEY=your-api-key-here
GPT_MODEL_NAME=gpt-4
MODEL_PATH=pair.pkl
TRAINING_DATA_PATH=sample-training-data.log
PAT_STR=('s|'t|'re|'ve|'m|'ll|'d| ?[\p{L}]+| ?[\p{N}]+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+)|(```[\s\S]*?```)|(`[^`]*`)|(\[[^\]]*\]\([^)]*\))
```

If you've properly set your API key, you should see the following prompt when you run `pair` in terminal:

```plaintext
Start chatting (type 'quit' to stop, press 'ctrl-d' to send)
> 
```

You can now start chatting with the AI. To send a message, press `ctrl-d`. To stop the conversation, type `quit` and press `ctrl-d`.

The prompt allows for multiline input so paste your code snippets directly into the terminal. Markdown code blocks and all 😁

Responses are formatted in markdown for easy reading. If you want to see the raw response (or a history of your chats), have a look at the `chat.log` file in the root of the project.

As well as basic chat functionality, pAIr has a few extra features!

### Set System Message

You can set the system message by typing `set_system` and pressing `ctrl-d`. 

You will be asked if you'd like to append to the current system message. If yes, press enter . Or if you'd like to set it fresh, press `n` and then return.

Now, type your message and press `ctrl-d` again to set the new system prompt. The new message will be displayed on success.

The default system message is used to ensure the AI returns a markdown formatted response. It also sets some configurations and tunings. Here is the default system message:

```plaintext
You are a GPT GPT-4 architecture, based on the GPT-4 architecture.
Knowledge cutoff: 2023-04
Current date: 2024-04-09

Image input capabilities: Enabled

You are programmed to respond to and introduce yourself by the name pAIr.
You are designed to assist users based on their current message and given the available conversation history.
You are a helpful assistant.

## pAIr's response guidelines

- You ALWAYS format your response as proper Markdown, including code blocks, headers, links, bold, italics, lists, tables, images, inline code, and blockquotes.
- You ALWAYS specify the language of a code block. 
- You NEVER consider Markdown formatted text to be code.
- You ALWAYS provide your sources for the information you provide
- You ALWAYS work through your answers logically in your response, presenting your reasoning clearly.
- You ALWAYS take your time to understand the user's question in the context of the conversation history.
- You ALWAYS interpret graphs, diagrams, and images, and you provide detailed explanations based on the visual input.
- You ALWAYS provide detailed explanations of code snippets and algorithms.
- You ALWAYS provide detailed explanations of mathematical equations and concepts.
- You ALWAYS provide detailed explanations of scientific concepts and theories.
```

You can also return this message by returning nothing when prompted to set the system message.

### Train the tokenizer

You can train the tokenizer with your own chat logs (or any other data).

The code will default to training from the `sample-training-data.log` file [provided in this repository](https://github.com/Michelleeby/pAIr/blob/4f4dd9779891d7e86eac40f99c4955800709f027/sample-training-data.log) on pAIr first use. If you have other data you want to train the tokenizer with, set the `TRAINING_DATA_PATH` environment variable to the path of the file. Its assumed the data is something like a chat log with alternating messages and markdown code blocks. To change the model file you load (or save to), set the `MODEL_PATH` environment variable to your desired path. If your data is not in the format of alternating messages and code blocks, you can change the pattern string used to tokenize the data by setting the `PAT_STR` environment variable.

For more info take a look at [__init__.py](https://github.com/Michelleeby/pAIr/blob/0ec83de1af0845f58f829b77c328c9253b6af9ff/__init__.py#L10-L13):

```python
# Defaults
model_path = os.getenv("MODEL_PATH", "pair.pkl")
training_data_path = os.getenv("TRAINING_DATA_PATH", "sample-training-data.log")
pat_str = os.getenv("PAT_STR", r"""('s|'t|'re|'ve|'m|'ll|'d| ?[\p{L}]+| ?[\p{N}]+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+)|(```[\s\S]*?```)|(`[^`]*`)|(\[[^\]]*\]\([^)]*\))""")
```

## Thanks and enjoy 🦾
