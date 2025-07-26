// static/FrontendBPE.js

class FrontendBPETokenizer {
    static _modelCache = null;
  
    static async loadModel(url = '/shared/tokenizer_merged_ranks.json') {
      if (FrontendBPETokenizer._modelCache) return FrontendBPETokenizer._modelCache;
      const resp = await fetch(url, { cache: 'force-cache' });
      if (!resp.ok) throw new Error("Failed to load tokenizer model");
      const model = await resp.json();
      if (!model.mergeable_ranks || !model.pat_str)
        throw new Error("Invalid tokenizer model format");
      FrontendBPETokenizer._modelCache = model;
      return model;
    }
  
    constructor(model) {
      this.ranks = model.mergeable_ranks;
      this.patStr = model.pat_str;
      // JS RegExp: use Unicode flag for \w etc.
      this.pattern = new RegExp(this.patStr, 'gu');
    }
  
    static toBytes(str) {
      return Array.from(new TextEncoder().encode(str));
    }
    static fromBytes(bytes) {
      return new TextDecoder().decode(Uint8Array.from(bytes));
    }
    static bytesToHex(bytes) {
      return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  
    /** Split text into tokens by pattern, then BPE-encode each. */
    encode(text) {
      const words = Array.from(text.matchAll(this.pattern)).map(m => m[0]);
      let tokens = [];
      for (const word of words) {
        tokens.push(...this._bpeEncodeWord(word));
      }
      return tokens.filter(Number.isFinite);
    }
  
    /** BPE-encode one word (already split). */
    _bpeEncodeWord(word) {
      // Word to byte sequence
      let parts = FrontendBPETokenizer.toBytes(word).map(b => [b]);
      // Merge until no more mergeable pairs
      while (true) {
        let minRank = null, minPairPos = null;
        for (let i = 0; i < parts.length - 1; ++i) {
          const merged = parts[i].concat(parts[i+1]);
          const hex = FrontendBPETokenizer.bytesToHex(merged);
          const rank = this.ranks[hex];
          if (rank !== undefined && (minRank === null || rank < minRank)) {
            minRank = rank; minPairPos = i;
          }
        }
        if (minRank === null) break;
        // Merge
        parts = [
          ...parts.slice(0, minPairPos),
          parts[minPairPos].concat(parts[minPairPos + 1]),
          ...parts.slice(minPairPos + 2)
        ];
      }
      // For each part, get final merge rank as token id
      return parts.map(bytes => this.ranks[FrontendBPETokenizer.bytesToHex(bytes)]);
    }
  }