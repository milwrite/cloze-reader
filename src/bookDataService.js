// Hugging Face Project Gutenberg Dataset Service
class HuggingFaceDatasetService {
  constructor() {
    // Use Hugging Face Datasets API for streaming
    this.datasetName = 'manu/project_gutenberg';
    this.apiBase = 'https://datasets-server.huggingface.co';
    this.books = [];
    this.isLoaded = false;
    this.streamingEnabled = false;
    this.cache = new Map();
    this.preloadedBooks = [];
    this.usedBooks = new Set(); // Track books used this session
  }

  // Local fallback books for when HF streaming is unavailable
  getSampleBooks() {
    return [
      {
        id: 1,
        title: "Pride and Prejudice",
        author: "Jane Austen",
        year: 1813,
        text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters. \"My dear Mr. Bennet,\" said his lady to him one day, \"have you heard that Netherfield Park is let at last?\" Mr. Bennet replied that he had not. \"But it is,\" returned she; \"for Mrs. Long has just been here, and she told me all about it.\" Mr. Bennet made no answer. \"Do you not want to know who has taken it?\" cried his wife impatiently. \"You want to tell me, and I have no objection to hearing it.\" This was invitation enough."
      },
      {
        id: 2,
        title: "The Adventures of Tom Sawyer",
        author: "Mark Twain",
        year: 1876,
        text: "\"Tom!\" No answer. \"Tom!\" No answer. \"What's gone with that boy, I wonder? You TOM!\" No answer. The old lady pulled her spectacles down and looked over them about the room; then she put them up and looked out under them. She seldom or never looked through them for so small a thing as a boy; they were her state pair, the pride of her heart, and were built for \"style,\" not service--she could have seen through a pair of stove-lids just as well. She looked perplexed for a moment, and then said, not fiercely, but still loud enough for the furniture to hear: \"Well, I lay if I get hold of you I'll--\""
      },
      {
        id: 3,
        title: "Great Expectations",
        author: "Charles Dickens",
        year: 1861,
        text: "My father's family name being Pirrip, and my Christian name Philip, my infant tongue could make of both names nothing longer or more explicit than Pip. So, I called myself Pip, and came to be called Pip. I give Pirrip as my father's family name, on the authority of his tombstone and my sister,--Mrs. Joe Gargery, who married the blacksmith. As I never saw my father or my mother, and never saw any likeness of them (for their days were long before the days of photographs), my first fancies regarding what they were like were unreasonably derived from their tombstones."
      },
      {
        id: 4,
        title: "Alice's Adventures in Wonderland",
        author: "Lewis Carroll",
        year: 1865,
        text: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversation?' So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her."
      },
      {
        id: 5,
        title: "The Picture of Dorian Gray",
        author: "Oscar Wilde",
        year: 1890,
        text: "The studio was filled with the rich odour of roses, and when the strong summer wind stirred, amidst the trees of the garden, there came through the open door the heavy scent of the lilac, or the more delicate perfume of the pink-flowering thorn. From the corner of the divan of Persian saddle-bags on which he was lying, smoking, as was his custom, innumerable cigarettes, Lord Henry Wotton could just catch the gleam of the honey-sweet and honey-coloured blossoms of a laburnum, whose tremulous branches seemed hardly able to bear the burden of a beauty so flamelike as theirs."
      },
      {
        id: 6,
        title: "Moby Dick",
        author: "Herman Melville",
        year: 1851,
        text: "Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people's hats off—then, I account it high time to get to sea as soon as possible."
      },
      {
        id: 7,
        title: "Jane Eyre",
        author: "Charlotte Bronte",
        year: 1847,
        text: "There was no possibility of taking a walk that day. We had been wandering, indeed, in the leafless shrubbery an hour in the morning; but since dinner (Mrs. Reed, when there was no company, dined early) the cold winter wind had brought with it clouds so sombre, and a rain so penetrating, that further out-door exercise was now out of the question. I was glad of it: I never liked long walks, especially on chilly afternoons: dreadful to me was the coming home in the raw twilight, with nipped fingers and toes, and a heart saddened by the chidings of Bessie, the nurse, and humbled by the consciousness of my physical inferiority to Eliza, John, and Georgiana Reed."
      },
      {
        id: 8,
        title: "The Count of Monte Cristo",
        author: "Alexandre Dumas",
        year: 1844,
        text: "On the first Monday of February, 1815, the watchtower at Marseilles signaled the arrival of the three-master Pharaon from Smyrna, Trieste, and Naples. As was customary, the pilot immediately left the port and steered toward the château d'If to conduct the ship through the narrow passage that leads to the harbor. However, a young sailor of about nineteen or twenty years, standing on the ship's bow, had signaled the pilot even before he had time to ask the traditional questions that are exchanged between the pilot and the captain. The young man had already assumed command, being the ship's owner and captain."
      },
      {
        id: 9,
        title: "Wuthering Heights",
        author: "Emily Bronte",
        year: 1847,
        text: "I have just returned from a visit to my landlord—the solitary neighbour that I shall be troubled with. This is certainly a beautiful country! In all England, I do not believe that I could have fixed on a situation so completely removed from the stir of society. A perfect misanthropist's Heaven: and Mr. Heathcliff and I are such a suitable pair to divide the desolation between us. A capital fellow! He little imagined how my heart warmed towards him when I beheld his black eyes withdraw so suspiciously under their brows, as I rode up, and when his fingers sheltered themselves, with a jealous resolution, still further in his waistcoat, as I announced my name."
      },
      {
        id: 10,
        title: "Frankenstein",
        author: "Mary Shelley",
        year: 1818,
        text: "It was on a dreary night of November that I beheld the accomplishment of my toils. With an anxiety that almost amounted to agony, I collected the instruments of life around me, that I might infuse a spark of being into the lifeless thing that lay at my feet. It was already one in the morning; the rain pattered dismally against the panes, and my candle was nearly burnt out, when, by the glimmer of the half-extinguished light, I saw the dull yellow eye of the creature open; it breathed hard, and a convulsive motion agitated its limbs. How can I describe my emotions at this catastrophe, or how delineate the wretch whom with such infinite pains and care I had endeavoured to form?"
      }
    ];
  }

  async loadDataset() {
    try {
      // Try to connect to HF Datasets API
      await this.initializeStreaming();
      
      if (this.streamingEnabled) {
        // Preload some books for immediate access
        await this.preloadBooks(5);
        console.log(`✅ HF Streaming enabled: ${this.preloadedBooks.length} books preloaded`);
      } else {
        // Fall back to local samples
        this.books = this.getSampleBooks();
        console.log(`⚠️ Using local samples: ${this.books.length} books available`);
      }
      
      this.isLoaded = true;
      return this.books;
    } catch (error) {
      console.error('Error loading dataset:', error);
      // Ensure we always have local fallback
      this.books = this.getSampleBooks();
      this.isLoaded = true;
      return this.books;
    }
  }

  async initializeStreaming() {
    try {
      // Test HF Datasets API availability
      const testUrl = `${this.apiBase}/splits?dataset=${this.datasetName}`;
      const response = await fetch(testUrl);
      
      if (response.ok) {
        const data = await response.json();
        // Check if English split is available
        const hasEnglish = data.splits?.some(split => 
          split.split === 'en' && split.config === 'default'
        );
        
        this.streamingEnabled = hasEnglish || data.splits?.length > 0;
        console.log(`🔗 HF Datasets API: ${this.streamingEnabled ? 'Available' : 'Unavailable'}`);
      }
    } catch (error) {
      console.warn('HF Datasets API test failed:', error);
      this.streamingEnabled = false;
    }
  }

  async preloadBooks(count = 5) {
    if (!this.streamingEnabled) return;
    
    try {
      // Use random offset to avoid always getting the same books
      const randomOffset = Math.floor(Math.random() * 1000);
      const url = `${this.apiBase}/rows?dataset=${this.datasetName}&config=default&split=en&offset=${randomOffset}&length=${count}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if data has expected structure
        if (!data.rows || !Array.isArray(data.rows)) {
          console.error('Unexpected HF API response structure:', data);
          return;
        }
        
        console.log(`📥 Received ${data.rows.length} books from HF API`);
        
        this.preloadedBooks = data.rows
          .map(row => {
            try {
              return this.processHFBookLazy(row.row);
            } catch (e) {
              console.warn('Error processing book:', e);
              return null;
            }
          })
          .filter(book => book !== null);
          
        console.log(`📚 Preloaded ${this.preloadedBooks.length} books (lazy validation)`);
      } else {
        console.error(`HF API request failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to preload books:', error);
    }
  }

  processHFBookLazy(rowData) {
    // Minimal processing - defer text cleaning and validation until book is selected
    const rawText = rowData.text || '';
    
    // Do basic metadata extraction to get proper title/author
    const extractedMetadata = this.extractMetadata(rawText);
    const title = extractedMetadata.title || rowData.title || 'Classic Literature';
    const author = extractedMetadata.author || rowData.author || 'Unknown Author';
    
    return {
      id: rowData.id || Math.random().toString(36),
      title: title,
      author: author,
      rawText: rawText,
      text: null, // Will clean when needed
      language: rowData.language || 'en',
      source: 'project_gutenberg',
      processed: false
    };
  }

  async processBookOnDemand(book) {
    if (book.processed) return book;
    
    console.log(`🔄 Processing "${book.title}" on demand...`);
    const startTime = Date.now();
    
    // Clean text when actually needed
    const cleanedText = this.cleanProjectGutenbergText(book.rawText);
    
    book.text = cleanedText;
    book.processed = true;
    
    // Validate after processing
    if (!this.isValidForCloze(book)) {
      console.log(`❌ "${book.title}" failed validation after ${Date.now() - startTime}ms`);
      return null;
    }
    
    console.log(`✅ "${book.title}" processed in ${Date.now() - startTime}ms`);
    return book;
  }


  cleanProjectGutenbergText(text) {
    if (!text) return '';
    
    let cleaned = text;
    
    // Remove Project Gutenberg start markers and everything before
    const startPatterns = [
      /\*\*\* START OF .*? \*\*\*/i,
      /\*\*\*START OF .*?\*\*\*/i,
      /START OF THE PROJECT GUTENBERG/i,
      /GUTENBERG.*?EBOOK/i
    ];
    
    for (const pattern of startPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const startIndex = match.index + match[0].length;
        // Skip to next line
        const nextLine = cleaned.indexOf('\n', startIndex);
        if (nextLine !== -1) {
          cleaned = cleaned.substring(nextLine + 1);
        }
        break;
      }
    }
    
    // Remove Project Gutenberg end markers and everything after
    const endPatterns = [
      /\*\*\* END OF .*? \*\*\*/i,
      /\*\*\*END OF .*?\*\*\*/i,
      /END OF THE PROJECT GUTENBERG/i,
      /End of the Project Gutenberg/i
    ];
    
    for (const pattern of endPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        cleaned = cleaned.substring(0, match.index);
        break;
      }
    }
    
    // Remove common Project Gutenberg artifacts
    cleaned = cleaned
      .replace(/\r\n/g, '\n')                           // Normalize line endings
      .replace(/produced from images generously.*?\n/gi, '') // Remove scanning notes
      .replace(/\n\s*\n\s*\n+/g, '\n\n')               // Remove excessive line breaks
      .replace(/^\s*CHAPTER.*$/gm, '')                  // Remove chapter headers
      .replace(/^\s*Chapter.*$/gm, '')                  // Remove chapter headers
      .replace(/^\s*\d+\s*$/gm, '')                     // Remove page numbers
      .replace(/^\s*\[.*?\]\s*$/gm, '')                 // Remove bracketed notes
      .replace(/^\s*_.*_\s*$/gm, '')                    // Remove italic notes
      .replace(/[_*]/g, '')                             // Remove underscores and asterisks
      .trim();
    
    // Find the actual start of narrative content
    const lines = cleaned.split('\n');
    let contentStart = 0;
    
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      const line = lines[i].trim();
      
      // Skip empty lines, title pages, and metadata
      if (!line || 
          line.includes('Title:') || 
          line.includes('Author:') ||
          line.includes('Release Date:') ||
          line.includes('Language:') ||
          line.includes('Character set') ||
          line.includes('www.gutenberg') ||
          line.includes('Project Gutenberg') ||
          line.length < 20) {
        contentStart = i + 1;
        continue;
      }
      
      // Found actual content
      break;
    }
    
    if (contentStart > 0 && contentStart < lines.length) {
      cleaned = lines.slice(contentStart).join('\n').trim();
    }
    
    return cleaned;
  }

  extractMetadata(text) {
    const metadata = { title: 'Classic Literature', author: 'Unknown Author' };
    
    if (!text) return metadata;
    
    // Look for the standard Project Gutenberg header format
    const firstLine = text.split('\n')[0].trim();
    
    // Parse the standard format: "The Project Gutenberg EBook of [TITLE], by [AUTHOR]"
    const pgMatch = firstLine.match(/^.*?The Project Gutenberg EBook of (.+?),\s*by\s+(.+?)$/i);
    if (pgMatch) {
      const title = pgMatch[1].trim();
      const author = pgMatch[2].trim();
      
      if (title && this.isValidTitle(title)) {
        metadata.title = this.cleanMetadataField(title);
      }
      if (author && this.isValidAuthor(author)) {
        metadata.author = this.cleanMetadataField(author);
      }
      
      return metadata;
    }
    
    // Fallback: Look for explicit Title: and Author: fields in first 50 lines
    const lines = text.split('\n').slice(0, 50);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('Title:')) {
        const title = line.replace('Title:', '').trim();
        if (title && title.length > 1) {
          metadata.title = this.cleanMetadataField(title);
        }
      } else if (line.startsWith('Author:')) {
        const author = line.replace('Author:', '').trim();
        if (author && author.length > 1) {
          metadata.author = this.cleanMetadataField(author);
        }
      }
    }
    
    return metadata;
  }

  cleanMetadataField(field) {
    return field
      .replace(/\[.*?\]/g, '') // Remove bracketed info
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }


  isValidTitle(title) {
    if (!title || title.length < 3 || title.length > 100) return false;
    // Avoid fragments that are clearly not titles
    if (title.includes('Project Gutenberg') || 
        title.includes('www.') || 
        title.includes('produced from') ||
        title.includes('images generously')) return false;
    return true;
  }

  isValidAuthor(author) {
    if (!author || author.length < 3 || author.length > 50) return false;
    // Basic validation - should look like a name
    if (author.includes('Project Gutenberg') || 
        author.includes('www.') ||
        author.includes('produced from')) return false;
    return true;
  }

  isValidForCloze(book) {
    if (!book.text) return false;
    
    const textLength = book.text.length;
    
    // Relaxed filter criteria for cloze exercises
    if (textLength < 2000) return false;        // Minimum readable length
    if (textLength > 500000) return false;      // Too long for performance
    
    // Check for excessive formatting (likely reference material)
    const lineBreakRatio = (book.text.match(/\n\n/g) || []).length / textLength;
    if (lineBreakRatio > 0.05) return false;    // Relaxed fragmentation threshold
    
    // Ensure it has actual narrative content
    const sentenceCount = (book.text.match(/[.!?]+/g) || []).length;
    if (sentenceCount < 10) return false;       // Relaxed sentence requirement
    
    console.log(`📖 Book validated: "${book.title}" (${textLength} chars, ${sentenceCount} sentences)`);
    return true;
  }

  async getRandomBook() {
    if (!this.isLoaded) {
      throw new Error('Dataset not loaded');
    }
    
    // First, try to find a successfully processed HF book
    if (this.streamingEnabled && this.preloadedBooks.length > 0) {
      const availableHFBooks = this.preloadedBooks.filter(book => 
        !this.usedBooks.has(this.getBookId(book))
      );
      
      for (const book of availableHFBooks) {
        const processedBook = await this.processBookOnDemand(book);
        if (processedBook) {
          this.usedBooks.add(this.getBookId(processedBook));
          console.log(`📚 Using HF book: "${processedBook.title}"`);
          return processedBook;
        }
      }
      
      // If no HF books worked, try streaming
      const streamedBook = await this.getStreamingBook();
      if (streamedBook) {
        this.usedBooks.add(this.getBookId(streamedBook));
        return streamedBook;
      }
    }
    
    // Fallback to local samples
    const fallbackBooks = this.books.length > 0 ? this.books : this.getSampleBooks();
    const availableBooks = fallbackBooks.filter(book => 
      !this.usedBooks.has(this.getBookId(book))
    );
    
    if (availableBooks.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableBooks.length);
      const book = availableBooks[randomIndex];
      this.usedBooks.add(this.getBookId(book));
      console.log(`📚 Using local book: "${book.title}"`);
      return book;
    }
    
    // If all books used, clear cache and start over
    this.usedBooks.clear();
    console.log('All books used, cleared used book cache');
    return this.getRandomBook();
  }

  getBookId(book) {
    // Create unique ID from title and author to track duplicates
    return `${book.title}_${book.author}`.replace(/\s+/g, '_').toLowerCase();
  }

  async getStreamingBook() {
    // Use preloaded books for immediate access
    if (this.preloadedBooks.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.preloadedBooks.length);
      let book = this.preloadedBooks[randomIndex];
      
      // Process on demand if needed
      if (!book.processed) {
        book = await this.processBookOnDemand(book);
      }
      
      return book;
    }
    
    // If no preloaded books, try to fetch directly
    try {
      const offset = Math.floor(Math.random() * 1000);
      const url = `${this.apiBase}/rows?dataset=${this.datasetName}&config=default&split=en&offset=${offset}&length=1`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        if (data.rows && data.rows.length > 0) {
          const book = this.processHFBookLazy(data.rows[0].row);
          return await this.processBookOnDemand(book);
        }
      }
    } catch (error) {
      console.warn('Direct streaming failed:', error);
    }
    
    return null;
  }

  async getBookByLevelCriteria(level) {
    return await this.getRandomBook();
  }



  getBookById(id) {
    // Search in both preloaded and local books
    const allBooks = [...this.preloadedBooks, ...this.books];
    return allBooks.find(book => book.id === id);
  }

  searchBooks(query) {
    if (!query) return [...this.preloadedBooks, ...this.books];
    
    const lowerQuery = query.toLowerCase();
    const allBooks = [...this.preloadedBooks, ...this.books];
    return allBooks.filter(book => 
      book.title.toLowerCase().includes(lowerQuery) ||
      book.author.toLowerCase().includes(lowerQuery)
    );
  }

  // Health check for streaming status
  getStatus() {
    return {
      streamingEnabled: this.streamingEnabled,
      preloadedBooks: this.preloadedBooks.length,
      localBooks: this.books.length,
      totalAvailable: this.preloadedBooks.length + this.books.length,
      source: this.streamingEnabled ? 'HuggingFace Datasets' : 'Local Samples'
    };
  }

  // Refresh preloaded books cache
  async refreshCache() {
    if (this.streamingEnabled) {
      await this.preloadBooks(20);
      console.log(`🔄 Cache refreshed: ${this.preloadedBooks.length} books`);
    }
  }
}

export default new HuggingFaceDatasetService();