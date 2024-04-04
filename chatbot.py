# Standard library imports
import os
import pickle
import traceback
import logging
from typing import Optional

# Local application imports
from SimpleBytePairEncoding import Tokenizer
from helpers import setup_logger, get_multi_line_input

# Related third party imports
from dotenv import load_dotenv
from openai import OpenAI

# Load environment vars
load_dotenv()

# Set up logging
chat_logger = setup_logger('chat_logger', 'chat.log', logging.INFO)
error_logger = setup_logger('error_logger', 'error.log', logging.ERROR)

class ChatBotClass:
    """
    A bot for interactive chatting, given a path to a trained model.

    Attributes
    ----------
    tokenizer : object
        The tokenizer loaded from the trained model.
    all_messages : list
        List storing all messages in the conversation.
    """

    def __init__(self, model_path: str, training_data: Optional[str] = None, vocab_size: Optional[int] = None, pat_str: Optional[str] = None):
        """Initialize the ChatBotClass with a model file.
        
        Parameters
        ----------
        model_path : str
            Path to the trained model file.
        training_data : str, optional
            The data to be used for training the model. Required if the model file does not exist.
        vocab_size : int, optional
            The maximum size of the vocabulary. Required if the model file does not exist.
        pat_str : str, optional
            A pattern string. Required if the model file does not exist.
        """
        if not os.path.exists(model_path):
            if training_data is None or vocab_size is None or pat_str is None:
                raise ValueError("Training data, vocab size, and pattern string are required to train a new model")
            tokenizer = Tokenizer.train(training_data, vocab_size, pat_str)
            tokenizer.save_model(model_path)

        with open(model_path, 'rb') as f:
            self.tokenizer = pickle.load(f)

        self.all_messages = []

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

    def set_system_message(self):
        """
        Set system message using multiline input entered by the user.

        Returns
        -------
        dict
            System message in predefined format.
        """
        content = get_multi_line_input()
        system_message = {"role": "system", "content": content}

        # Add system message to the list of messages
        self.all_messages.append(system_message)

        return system_message

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
        chat_logger.info(f'> {user_message}')

        new_message_content = {"role": "user", "content": user_message, "tokens": self.count_tokens(user_message)}
        total_tokens = sum([m['tokens'] for m in self.all_messages])

        if total_tokens + new_message_content['tokens'] > 4000:  # Let's save some space for the model's output
            while total_tokens + new_message_content['tokens'] > 4000 and len(self.all_messages) > 0:
                removed_message = self.all_messages.pop(0)
                total_tokens -= removed_message['tokens']

        self.all_messages.append(new_message_content)

        # Create a copy of all_messages without the 'tokens' property
        messages_to_send = [{"role": m["role"], "content": m["content"]} for m in self.all_messages]

        model_name = os.getenv('MODEL_NAME', 'gpt-4')
        response = client.chat.completions.create(model=model_name, messages=messages_to_send)

        generated_text = response.choices[0].message.content
        chat_logger.info(f'>> {generated_text}')

        # Add the chatbot's response to the list of messages
        self.all_messages.append({"role": "assistant", "content": generated_text, "tokens": self.count_tokens(generated_text)})

        return generated_text
    
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
    
    def chat_main_process(self):
        """Main chatbot interaction loop."""
        try:
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
        except Exception as e:
            error_logger.error(f'An error occurred: {e}\n{traceback.format_exc()}')
            raise
