# --- Imports ---

# Standard library imports
import collections
import logging

# Third party imports
import regex
import pickle

# Local application imports
from helpers import setup_logger

# --- Setup ---
error_logger = setup_logger('tokenizer_error_logger', 'tokenizer-error.log', logging.ERROR)
audit_logger = setup_logger('tokenizer_audit_logger', 'tokenizer-audit.log', logging.INFO)

# --- Tokenizer class ---
class Tokenizer:
    """
    A Byte Pair Encoding tokenizer class.

    Attributes
    ----------
    pat_str : str
        A pattern string.

    mergeable_ranks : dict
        A dictionary containing mergeable ranks.

    _decoder : dict
        A dictionary for decoding tokens.

    _pat : regex.Pattern
        A compiled regex pattern.
    """

    # -- Constructor --

    def __init__(self, *, pat_str: str, mergeable_ranks: dict[bytes, int]) -> None:
        """
        Initialize the Tokenizer class.

        Parameters
        ----------
        pat_str : str
            A pattern string.

        mergeable_ranks : dict
            A dictionary containing mergeable ranks.
        """

        self.pat_str = pat_str
        self.mergeable_ranks = mergeable_ranks
        self._decoder = {token: token_bytes for token_bytes, token in mergeable_ranks.items()}
        self._pat = regex.compile(pat_str)

    # -- Encoding and decoding methods --

    def encode(self, text: str) -> list[int]:
        """
        Encodes text to tokens using Byte Pair Encoding.

        Args:
            text (str): The input text to be encoded.

        Returns:
            list[int]: A list of tokens.
        """
        words = self._pat.findall(text)
        tokens = []
        for word in words:
            if isinstance(word, tuple):
                word = ''.join(word)
            word_bytes = word.encode("utf-8")
            word_tokens = bpe_encode(self.mergeable_ranks, word_bytes)
            tokens.extend(word_tokens)
        return tokens

    def decode(self, tokens: list[int]) -> str:
        """
        Decodes tokens to text.

        Args:
            tokens (list[int]): A list of tokens.
            
        Returns:
            str: The decoded text.
        """
        return self.decode_bytes(tokens).decode("utf-8", errors="replace")
    
    def decode_bytes(self, tokens: list[int]) -> bytes:
        """
        Decodes tokens to bytes.

        Args:
            tokens (list[int]): A list of tokens.

        Returns:
            bytes: The decoded bytes.
        """
        return b"".join(self._decoder.get(token, b"") for token in tokens)

    # -- Serialization methods --

    def save_model(self, file_path: str) -> None:
        """
        Save the model to a file.

        Args:
            file_path (str): The path to the file.
        """
        with open(file_path, 'wb') as f:
            pickle.dump(self, f)

        audit_logger.info(f'Tokenizer model saved to {file_path}')

    @staticmethod
    def load_model(file_path: str):
        """
        Load the trained model from a file.

        Args:
            file_path (str): The path to the file.

        Returns:
            Tokenizer: The loaded tokenizer.
        """
        with open(file_path, 'rb') as f:
            return pickle.load(f)

    # -- Validation and training methods --

    def validate(self, data, verbose=False):
        """
        Validate the tokenizer on a set of data.

        Args:
            data: A list of data.
            verbose: A boolean flag to enable verbose output.
        """
        failing_cases = []
        for entry in data:
            encoded = self.encode(entry)
            decoded = self.decode(encoded)
            if entry != decoded:
                msg = f'Failed on input {entry}. Output was {decoded}'
                failing_cases.append(entry)
                error_logger.error(msg)
                if verbose:
                    print(msg)
                    
        if verbose:
            msg = f'Validation completed. Number of failing cases: {len(failing_cases)}'
            audit_logger.info(msg)
            print(msg)

        return failing_cases

    @staticmethod
    def train(training_data: str, vocab_size: int, pat_str: str):
        """
        Train a Byte Pair Encoding tokenizer on given data.

        Args:
            training_data (str): The input data for training.
            vocab_size (int): The maximum size of the vocabulary.
            pat_str (str): A pattern string.

        Returns:
            Tokenizer: The trained tokenizer.
        """
        mergeable_ranks = bpe_train(data=training_data, vocab_size=vocab_size, pat_str=pat_str)

        audit_logger.info(f'Training completed. Vocabulary size: {len(mergeable_ranks)}')

        return Tokenizer(pat_str=pat_str, mergeable_ranks=mergeable_ranks)

# --- Byte Pair Encoding functions ---

def bpe_encode(mergeable_ranks: dict[bytes, int], input: bytes) -> list[int]:
    """
    Encodes input data using Byte Pair Encoding.

    Args:
        mergeable_ranks (dict): A dictionary containing mergeable ranks.
        input (bytes): The input data to be encoded.

    Returns:
        list[int]: A list of tokens.
    """
    
    # Split input into individual bytes
    parts = [bytes([b]) for b in input]
    while True:
        min_idx = None
        min_rank = None
        # Find the pair with the lowest rank
        for i, pair in enumerate(zip(parts[:-1], parts[1:])):
            rank = mergeable_ranks.get(pair[0] + pair[1])
            if rank is not None and (min_rank is None or rank < min_rank):
                min_idx = i
                min_rank = rank

        # If no pair was found, break the loop
        if min_rank is None:
            break

        # Merge the pair with the lowest rank
        parts = parts[:min_idx] + [parts[min_idx] + parts[min_idx + 1]] + parts[min_idx + 2 :]

    # Convert parts to tokens using the mergeable ranks
    tokens = [mergeable_ranks[part] for part in parts]
    return tokens

def bpe_train(data: str, vocab_size: int, pat_str: str) -> dict[bytes, int]:
    """
    Trains a Byte Pair Encoding tokenizer on given data.

    Args:
        data (str): The input data for training.
        vocab_size (int): The maximum size of the vocabulary.
        pat_str (str): A pattern string.

    Returns:
        dict: A dictionary containing mergeable ranks.

    Raises:
        ValueError: If vocab_size is less than 256.
    """

    if vocab_size < 2**8:
        error_logger.error("vocab_size must be at least 256, so we can encode all bytes")
        raise ValueError("vocab_size must be at least 256, so we can encode all bytes")
    
    ranks = {}

    # Initialize ranks with individual bytes
    for i in range(2**8):
        ranks[bytes([i])] = i

    # Split data into words and then into individual bytes
    words: list[list[bytes]] = [
        [bytes([b]) for b in ''.join(word).encode("utf-8")] for word in regex.findall(pat_str, data)
    ]

    # Continue until we reach the desired vocabulary size
    while len(ranks) < vocab_size:
        stats = collections.Counter()
        # Count the frequency of each pair
        for piece in words:
            for pair in zip(piece[:-1], piece[1:]):
                stats[pair] += 1

        # If there are no more pairs, break the loop
        if not stats:
            break

        # Find the most common pair
        most_common_pair = max(stats, key=lambda x: stats[x])
        token_bytes = most_common_pair[0] + most_common_pair[1]
        token = len(ranks)
        ranks[token_bytes] = token

        # Replace the most common pair with the new token in all words
        new_words = []
        for word in words:
            new_word = []
            i = 0
            while i < len(word) - 1:
                if (word[i], word[i + 1]) == most_common_pair:
                    new_word.append(token_bytes)
                    i += 2
                else:
                    new_word.append(word[i])
                    i += 1
            if i == len(word) - 1:
                new_word.append(word[i])
            new_words.append(new_word)
        words = new_words

    return ranks