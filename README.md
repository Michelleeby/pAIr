# pAIr

Simple pair programming/chat assistant CLI tool powered by openAI (defaults to "gpt-4" model).

## Requirements

- [Python](https://www.python.org/) (12.2.0+ recommended)
- [OpenAI API key (free or paid)](https://platform.openai.com/api-keys)

## Features

- Chat with "gpt4" without leaving the terminal
- Set the system prompt during the conversation
- Train the tokenizer with your own chat logs

## Installation

Your going to need a working python version. This code was developed with 12.2.0. You can check your python version by running the following command:

```bash
python --version
```

Check out [pyenv](https://github.com/pyenv) if you need to manage multiple python versions.

If you want to quickly get set up with python 12.2.0, you can run the following commands:

```bash
curl https://pyenv.run | bash
echo 'export PATH="$HOME/.pyenv/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init --path)"' >> ~/.bashrc
echo 'eval "$(pyenv init -)"' >> ~/.bashrc
source ~/.bashrc
pyenv install 12.2.0
```

Next, you need to install the required dependencies. Its recommended to use a virtual environment. You can do this by running the following commands:

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

You can add an alias to your `.bashrc` or `.zshrc` file to quickly start the chat assistant. You can do this by running the following command:

```bash
echo "alias pair='source $(pwd)/pair/bin/activate && python $(pwd)/pair.py && deactivate'" >> ~/.bashrc
source ~/.bashrc
```

Then simply type `pair` in your terminal to start the chat assistant.

## Usage

If you've properly set your API key, you should see the following prompt:

```plaintext
Start chatting (type 'quit' to stop, press 'ctrl-d' to send)
> 
```

You can now start chatting with the AI. To send a message, press `ctrl-d`. To stop the conversation, type `quit` and press `ctrl-d`.

The prompt allows for multiline input so paste your code snippets directly into the terminal. Markdown code blocks and all 😁

### Set System Message

You can set the system message by typing `set_system` and pressing `ctrl-d`. Then type your message, same as a normal prompt, and press `ctrl-d` again to set it. The system message will be displayed on success.

```plaintext
> set_system
>>> You are a helpful assistant, but sometimes you type things in AlTernAtIng cAps.
System message set to:
 You are a helpful assistant, but sometimes you type things in AlTernAtIng cAps.
> Hello, world!
>>  HeLlO, WoRlD!
```

### Train Tokenizer

You can train the tokenizer with your own chat logs.

Without a `chat.log` file on the os or without another trained model file defined, the code will default to training from the `sample-training-data.log` file [provided in this repository](https://github.com/Michelleeby/pAIr/blob/4f4dd9779891d7e86eac40f99c4955800709f027/sample-training-data.log). If you have other data you want to train the tokenizer with, set the `TRAINING_DATA_PATH` environment variable to the path of the file. Its assumed the data is something like a chat log with alternating messages and markdown code blocks. To change the model file you load (or save to), set the `MODEL_PATH` environment variable to the path of the model file. If your data is not in the format of alternating messages and code blocks, you can change the pattern string used to tokenize the data by setting the `PAT_STR` environment variable.

For more info take a look at [__init__.py](https://github.com/Michelleeby/pAIr/blob/0ec83de1af0845f58f829b77c328c9253b6af9ff/__init__.py#L10-L13):

```python
# Defaults
model_path = os.getenv("MODEL_PATH", "pair.pkl")
training_data_path = os.getenv("TRAINING_DATA_PATH", "sample-training-data.log")
pat_str = os.getenv("PAT_STR", r"""('s|'t|'re|'ve|'m|'ll|'d| ?[\p{L}]+| ?[\p{N}]+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+)|(```[\s\S]*?```)|(`[^`]*`)|(\[[^\]]*\]\([^)]*\))""")
```

### Configuration

You can configure the chat assistant by setting the following environment variables:

- `OPENAI_API_KEY`: Your openAI API key
- `GPT_MODEL_NAME`: The name of the model to use (default "gpt-4")
- `MODEL_PATH`: The path to the model file for the tokenizer
- `TRAINING_DATA_PATH`: The path to the chat log file for training the tokenizer
- `PAT_STR`: The pattern string for the tokenizer

## Thanks and enjoy 🦾
