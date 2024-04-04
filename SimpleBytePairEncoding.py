import collections
from typing import Optional

import regex
import pickle


class Tokenizer:
    """This class provides a tokenizer model that can use byte pair encoding (BPE) method."""

    def __init__(self, *, pat_str: str, mergeable_ranks: dict[bytes, int]) -> None:
        """Initialize Tokenizer with pattern string and mergeable ranks.
        
        Args:
            pat_str (str): A pattern string.
            mergeable_ranks (dict[bytes, int]): A dictionary containing mergeable ranks.
        """
        self.pat_str = pat_str
        self.mergeable_ranks = mergeable_ranks

        self._decoder = {token: token_bytes for token_bytes, token in mergeable_ranks.items()}
        self._pat = regex.compile(pat_str)

    def encode(self, text: str) -> list[int]:
        """Encodes a string into tokens.
        
        Args:
            text (str): The input text to be encoded.
        
        Returns:
            List of integer tokens.
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

    def decode_bytes(self, tokens: list[int]) -> bytes:
        """Decodes a list of tokens into bytes.
        
        Args:
            tokens (list[int]): A list of integer tokens to be decoded.
        
        Returns:
            Bytes corresponding to the input tokens.
        """
        return b"".join(self._decoder[token] for token in tokens)

    def decode(self, tokens: list[int]) -> str:
        """Decodes a list of tokens into a string.
        
        Args:
            tokens (list[int]): A list of integer tokens to be decoded.
        
        Returns:
            String corresponding to the input tokens.
        """
        return self.decode_bytes(tokens).decode("utf-8", errors="replace")

    def save_model(self, file_path: str) -> None:
        """Saves the trained model to a file.
        
        Args:
            file_path (str): The path to the file where the model should be saved.
        """
        with open(file_path, 'wb') as f:
            pickle.dump(self, f)

    @staticmethod
    def train(training_data: str, vocab_size: int, pat_str: str):
        """Train a BPE tokenizer on some data!
        
        Args:
            training_data (str): The data to be used for training the model.
            vocab_size (int): The maximum size of the vocabulary.
            pat_str (str): A pattern string.
            
        Returns:
            A trained tokenizer instance.
        """
        mergeable_ranks = bpe_train(data=training_data, vocab_size=vocab_size, pat_str=pat_str)
        return Tokenizer(pat_str=pat_str, mergeable_ranks=mergeable_ranks)


def bpe_encode(mergeable_ranks: dict[bytes, int], input: bytes) -> list[int]:
    """Encodes input data using Byte Pair Encoding.
    
    Args:
        mergeable_ranks (dict[bytes, int]): A dictionary containing mergeable ranks.
        input (bytes): The input data in bytes to be encoded.
        
    Returns:
        A list of tokens. 
    
    """
    parts = [bytes([b]) for b in input]
    while True:
        min_idx = None
        min_rank = None
        for i, pair in enumerate(zip(parts[:-1], parts[1:])):
            rank = mergeable_ranks.get(pair[0] + pair[1])
            if rank is not None and (min_rank is None or rank < min_rank):
                min_idx = i
                min_rank = rank

        if min_rank is None:
            break

        parts = parts[:min_idx] + [parts[min_idx] + parts[min_idx + 1]] + parts[min_idx + 2 :]

    tokens = [mergeable_ranks[part] for part in parts]
    return tokens

def bpe_train(data: str, vocab_size: int, pat_str: str) -> dict[bytes, int]:
    """Trains a Byte Pair Encoding tokenizer on given data.
    
    Args:
        data (str): The input data for training.
        vocab_size (int): The maximum size of the vocabulary.
        pat_str (str): A pattern string.

    Returns:
        A dictionary containing the final mergeable ranks.

    Raises:
        ValueError: If the vocab_size is less than 256.
    """
    if vocab_size < 2**8:
        raise ValueError("vocab_size must be at least 256, so we can encode all bytes")
    ranks = {}
    for i in range(2**8):
        ranks[bytes([i])] = i

    words: list[list[bytes]] = [
        [bytes([b]) for b in ''.join(word).encode("utf-8")] for word in regex.findall(pat_str, data)
    ]

    while len(ranks) < vocab_size:
        stats = collections.Counter()
        for piece in words:
            for pair in zip(piece[:-1], piece[1:]):
                stats[pair] += 1

        if not stats:
            break

        most_common_pair = max(stats, key=lambda x: stats[x])
        token_bytes = most_common_pair[0] + most_common_pair[1]
        token = len(ranks)
        ranks[token_bytes] = token

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