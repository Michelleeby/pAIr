# Standard library imports
import logging
import re

# Third-party library imports
from prompt_toolkit import prompt, key_binding
from pygments import highlight
from pygments.lexers import get_lexer_by_name
from pygments.formatters import TerminalFormatter

def setup_logger(name, log_file, level=logging.INFO):
    """Function setup as many loggers as you want"""
    handler = logging.FileHandler(log_file) 
    handler.setLevel(level)

    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.addHandler(handler)

    return logger

def get_multi_line_input(prompt_message="> "):
    """
    Collect multi-line user input until Ctrl+D is pressed.

    Parameters
    ----------
    prompt_message : str, optional
        The message to display while requesting input, by default '> '

    Returns
    -------
    str
        Multiline user input.
    """
    # Create a custom key bindings object
    kb = key_binding.KeyBindings()
    # Bind the "Ctrl+D" key to accept the input
    @kb.add('c-d')
    def _(event):
        event.current_buffer.validate_and_handle()
    # Get user input
    text = prompt(prompt_message, multiline=True, key_bindings=kb)

    return text

def colorize_code(code, language):
    lexer = get_lexer_by_name(language)
    formatter = TerminalFormatter()
    return highlight(code, lexer, formatter)

def colorize_code_blocks(text):
    blocks = re.split(r'(```.*?```)', text, flags=re.DOTALL)
    for i in range(len(blocks)):
        if blocks[i].startswith('```'):
            if '\n' in blocks[i][3:]:
                language, code = blocks[i][3:].split('\n', 1)
            else:
                language = 'plaintext'
                code = blocks[i][3:].rstrip('\n```')
            language = language.strip()
            code = code.rstrip('\n```')
            blocks[i] = '```' + language + '\n' + colorize_code(code, language) + '```'
    return ''.join(blocks)