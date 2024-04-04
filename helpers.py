import logging
from prompt_toolkit import prompt, key_binding

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