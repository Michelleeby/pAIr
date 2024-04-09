# --- Imports ---

# Standard library imports
import os
import traceback
import logging
from typing import Optional
from collections import deque

# Local application imports
from SimpleBytePairEncoding import TokenizerService
from helpers import setup_logger, get_multi_line_input

# Related third party imports
from dotenv import load_dotenv
from openai import OpenAI
from rich import print
from rich.markdown import Markdown

# --- Setup ---

# Set constants
TOKEN_MAX_LIMIT = 4096

DEFAULT_SYSTEM_MESSAGE = """
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
"""

# Load environment vars
load_dotenv()

# Instantiate loggers
chat_logger = setup_logger('chat_logger', 'chat.log', logging.INFO)
error_logger = setup_logger('error_logger', 'error.log', logging.ERROR)

# --- Main class ---
class ChatBotClass:
    """
    A bot for interactive chatting in terminal.

    Attributes
    ----------
    tokenizer : object
        The tokenizer loaded from the trained model.

    all_messages : deque
        A double-ended queue to store all messages in the conversation.
    """

    # -- Constructor --

    def __init__(self, model_path: str, training_data: Optional[str] = None, vocab_size: Optional[int] = None, pat_str: Optional[str] = None):
        """Initialize the ChatBotClass with a model file.
        
        Parameters
        ----------
        model_path : str
            Path to the trained tokenizer model file.

        training_data : str, optional
            The data to be used for training the tokenizer model. Required if the model file does not exist.

        vocab_size : int, optional
            The maximum size of the vocabulary. Required if the model file does not exist.

        pat_str : str, optional
            A pattern string. Required if the model file does not exist.
        """
        self.model_path = model_path
        self.train_data = training_data
        self.vocab_size = vocab_size
        self.pat_str = pat_str
        self.tokenizer = TokenizerService(model_path, training_data, vocab_size, pat_str).tokenizer
        
        self.all_messages = deque() # See https://docs.python.org/3/library/collections.html#collections.deque

    # -- Chat token related methods --

    def count_tokens(self, text: str) -> int:
        """Count the number of tokens in a text string.

        Parameters
        ----------
        text : str
            The input text for which tokens are to be counted.

        Returns
        -------
        int
            Number of tokens in the input text.
        """
        tokens = self.tokenizer.encode(text)
        return len(tokens)
    
    def calculate_total_tokens(self):
        """Calculate the total number of tokens in the conversation.

        Returns
        -------
        int
            Total number of tokens in the conversation.
        """
        return sum([m['tokens'] for m in self.all_messages])
    
    def return_system_message_tokens(self):
        """Return the number of tokens in the system message.

        Returns
        -------
        int
            Number of tokens in the system message.
        """
        return self.all_messages[-1]['tokens']
    
    def manage_token_limit(self, new_message_tokens: int):
        """Manage the token limit by removing messages from the conversation.

        Parameters
        ----------
        new_message_tokens : int
            Number of tokens in the new message.
        """
        total_tokens = self.calculate_total_tokens()
        while total_tokens + new_message_tokens > TOKEN_MAX_LIMIT - self.return_system_message_tokens() and len(self.all_messages) > 1:
            removed_message = self.all_messages.popleft() # See https://en.wikipedia.org/wiki/Double-ended_queue
            total_tokens -= removed_message['tokens']
        return total_tokens
    
    # -- Chatbot interaction methods --

    def handle_user_messages(self):
        """
        Handle user input by setting system message if needed and return the user message.

        Returns
        -------
        str
            User message if it is not a command to set the system message.
        """
        user_message = get_multi_line_input()

        if user_message.lower().startswith('set_system'):
            self.set_system_message()
            chat_logger.info(f'System: {self.all_messages[-1]["content"]}')
            print("System message set to:\n", self.all_messages[-1]["content"])
            user_message = None

        return user_message
    
    def chatbot_interaction(self, client, user_message):
        """
        Handle interaction with the chatbot and log the conversation.

        Parameters
        ----------
        client : object
            An instance of the OpenAI client.
        user_message : str
            Message sent by the user to the chatbot.

        Returns
        -------
        str
            Text generated by the chatbot.
        """
        new_message_tokens = self.count_tokens(user_message)
        self.manage_token_limit(new_message_tokens)

        self.all_messages.append({"role": "user", "content": user_message, "tokens": new_message_tokens})
        messages_to_send = [{"role": m["role"], "content": m["content"]} for m in self.all_messages]

        generated_text = self.get_response(client, messages_to_send)
        self.all_messages.append({"role": "system", "content": generated_text, "tokens": self.count_tokens(generated_text)})
        self.log_message(user_message, generated_text)
        
        return Markdown(generated_text)
     
    def set_system_message_default(self):
        """
        Set a default system message.
        """
        default_message = os.getenv('DEFAULT_SYSTEM_MESSAGE', DEFAULT_SYSTEM_MESSAGE)
        system_message = {"role": "system", "content": default_message, "tokens": self.count_tokens(default_message)}
        self.all_messages.append(system_message)
        return system_message
    
    def set_system_message(self):
        """
        Set system message using multiline input entered by the user.

        Returns
        -------
        dict
            System message in predefined format.
        """
        append = False if input("Do you want to append to the current system message? (y/n): ").lower() == 'n' else True
        print("Enter the system message (press 'ctrl-d' to send):")
        content = get_multi_line_input(">>> ")
        
        if not content:
            return self.set_system_message_default()
        
        if append:
            content = f'{self.all_messages[-1]["content"]}\n\n{content}'

        system_message = {"role": "system", "content": content, "tokens": self.count_tokens(content)}

        # Add system message to the list of messages
        self.all_messages.append(system_message)

        return system_message
    
    def log_message(self, user_message, generated_text):
        """Log the user message and the generated text.

        Parameters
        ----------
        user_message : str
            Message sent by the user to the chatbot.
        generated_text : str
            Text generated by the chatbot.
        """
        chat_logger.info(f'> {user_message}')
        chat_logger.info(f'>> {generated_text}')

    # -- OpenAI API methods --

    def setup_openai_api_client(self):
        """Initialize the OpenAI API client with the API key from the environment.

        Returns
        -------
        client : object
            An instance of the OpenAI client.

        Raises
        -------
        KeyError
            If 'OPENAI_API_KEY' not found in the environment.
        """
        return OpenAI(api_key=os.environ['OPENAI_API_KEY'])
    
    def get_response(self, client, messages_to_send):
        """Get the response from the chatbot.

        Parameters
        ----------
        client : object
            An instance of the OpenAI client.
        messages_to_send : list
            List of messages to send to the chatbot.

        Returns
        -------
        str
            Text generated by the chatbot.
        """
        response = client.chat.completions.create(model=os.getenv('GPT_MODEL_NAME', 'gpt-4'), messages=messages_to_send)
        return response.choices[0].message.content

    # -- Main process --

    def chat_main_process(self):
        """Main chatbot interaction loop."""
        client = self.setup_openai_api_client()
        print("Start chatting (type 'quit' to stop, press 'ctrl-d' to send)\n")
        while True:
            try:
                user_message = self.handle_user_messages()
                if user_message is None:
                    continue
                elif user_message.lower() == 'quit':
                    break
                response = self.chatbot_interaction(client, user_message)
                print(">> ", response)
            except Exception as e:
                error_logger.error(f'An error occurred: {e}\n{traceback.format_exc()}')
