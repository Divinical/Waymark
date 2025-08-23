/**
 * Smart Title Generation for Chapter Markers
 * Analyzes video content and context to generate meaningful marker titles
 */

const CMBTitleGenerator = (() => {

  /**
   * Video type patterns for classification
   */
  const videoTypePatterns = {
    tutorial: [
      /tutorial/i, /lesson/i, /how to/i, /guide/i, /walkthrough/i, 
      /step by step/i, /learn/i, /course/i, /training/i
    ],
    lecture: [
      /lecture/i, /presentation/i, /talk/i, /seminar/i, /webinar/i,
      /conference/i, /symposium/i, /workshop/i
    ],
    music: [
      /song/i, /music/i, /album/i, /track/i, /playlist/i,
      /concert/i, /performance/i, /live/i, /acoustic/i
    ],
    gaming: [
      /gameplay/i, /playthrough/i, /walkthrough/i, /gaming/i,
      /let's play/i, /stream/i, /speedrun/i
    ],
    interview: [
      /interview/i, /q&a/i, /discussion/i, /conversation/i,
      /podcast/i, /chat/i, /talk show/i
    ],
    review: [
      /review/i, /unboxing/i, /first look/i, /overview/i,
      /analysis/i, /breakdown/i, /reaction/i
    ],
    documentary: [
      /documentary/i, /history/i, /biography/i, /story/i,
      /documentary/i, /investigation/i
    ]
  };

  /**
   * Common chapter patterns
   */
  const chapterPatterns = {
    numbered: /(?:chapter|part|episode|section|lesson|step)\s*(\d+)/i,
    intro: /intro(?:duction)?|beginning|start|opening/i,
    outro: /outro|conclusion|end(?:ing)?|closing|summary|wrap.?up/i,
    middle: /middle|continued?|part|section/i
  };

  /**
   * Time-based title patterns
   */
  const timeBasedTitles = {
    veryEarly: (t) => t < 60 ? ['Introduction', 'Opening', 'Welcome', 'Getting Started'] : null,
    early: (t) => t < 300 ? ['Setup', 'Overview', 'Background', 'Context'] : null,
    middle: (t, duration) => t > duration * 0.2 && t < duration * 0.8 ? ['Main Content', 'Deep Dive', 'Analysis', 'Discussion'] : null,
    late: (t, duration) => t > duration * 0.8 ? ['Wrap Up', 'Summary', 'Conclusion', 'Final Thoughts'] : null
  };

  /**
   * Classify video type based on title and URL
   * @param {string} videoTitle - The video title
   * @param {string} url - The video URL
   * @returns {string} Detected video type
   */
  function classifyVideoType(videoTitle, url) {
    const fullText = `${videoTitle} ${url}`.toLowerCase();
    
    for (const [type, patterns] of Object.entries(videoTypePatterns)) {
      if (patterns.some(pattern => pattern.test(fullText))) {
        return type;
      }
    }
    
    return 'general';
  }

  /**
   * Extract structured information from video title
   * @param {string} videoTitle - The video title
   * @returns {Object} Extracted information
   */
  function analyzeVideoTitle(videoTitle) {
    const analysis = {
      hasNumbers: /\d+/.test(videoTitle),
      hasSeries: /(?:part|episode|chapter|lesson|step)\s*\d+/i.test(videoTitle),
      hasSubtitle: /:|-|—/.test(videoTitle),
      segments: [],
      keywords: []
    };

    // Split by common delimiters to find segments
    const delimiters = /[:\-—|]/;
    analysis.segments = videoTitle.split(delimiters).map(s => s.trim()).filter(s => s.length > 0);

    // Extract keywords (words longer than 3 characters)
    analysis.keywords = videoTitle.match(/\b\w{4,}\b/g) || [];

    return analysis;
  }

  /**
   * Detect patterns in existing markers
   * @param {Array} existingMarkers - Array of existing markers
   * @returns {Object} Pattern analysis
   */
  function analyzeMarkerPatterns(existingMarkers) {
    if (!existingMarkers || existingMarkers.length === 0) {
      return { pattern: 'none', nextNumber: 1, format: 'Chapter %d' };
    }

    const titles = existingMarkers.map(m => m.title || '').filter(t => t);
    
    // Check for numbered patterns
    const numberedTitles = titles.filter(title => /\d+/.test(title));
    if (numberedTitles.length >= titles.length * 0.5) { // More than half are numbered
      // Find highest number
      let maxNum = 0;
      let commonFormat = 'Chapter %d';
      
      numberedTitles.forEach(title => {
        const numberMatch = title.match(/(\d+)/);
        if (numberMatch) {
          maxNum = Math.max(maxNum, parseInt(numberMatch[1]));
          // Try to detect format
          if (title.toLowerCase().includes('part')) {
            commonFormat = 'Part %d';
          } else if (title.toLowerCase().includes('step')) {
            commonFormat = 'Step %d';
          } else if (title.toLowerCase().includes('lesson')) {
            commonFormat = 'Lesson %d';
          }
        }
      });

      return {
        pattern: 'numbered',
        nextNumber: maxNum + 1,
        format: commonFormat
      };
    }

    // Check for alphabetical patterns
    const alphaPattern = /^[A-Z]\.?\s/;
    const alphaTitles = titles.filter(title => alphaPattern.test(title));
    if (alphaTitles.length >= titles.length * 0.5) {
      return {
        pattern: 'alphabetical',
        nextLetter: String.fromCharCode(65 + titles.length), // A, B, C, etc.
        format: '%s.'
      };
    }

    // Check for time-based patterns
    const hasTimeReferences = titles.some(title => 
      /(?:intro|start|middle|end|conclusion|beginning|opening|closing)/i.test(title)
    );

    return {
      pattern: hasTimeReferences ? 'contextual' : 'freeform',
      nextNumber: titles.length + 1,
      format: 'Section %d'
    };
  }

  /**
   * Generate title based on video type and context
   * @param {string} videoType - Classified video type
   * @param {number} timestamp - Marker timestamp in seconds
   * @param {number} totalDuration - Total video duration in seconds
   * @param {Object} patterns - Detected patterns from existing markers
   * @param {Object} videoAnalysis - Analysis of video title
   * @returns {string} Generated title
   */
  function generateTitleByType(videoType, timestamp, totalDuration, patterns, videoAnalysis) {
    // Use existing pattern if detected
    if (patterns.pattern === 'numbered') {
      return patterns.format.replace('%d', patterns.nextNumber);
    }

    if (patterns.pattern === 'alphabetical') {
      return patterns.format.replace('%s', patterns.nextLetter);
    }

    // Time-based generation
    for (const [timePhase, checkFunction] of Object.entries(timeBasedTitles)) {
      const suggestions = checkFunction(timestamp, totalDuration);
      if (suggestions) {
        // Prefer titles that match video type
        const typedSuggestion = getTypedSuggestion(suggestions, videoType, patterns.nextNumber);
        if (typedSuggestion) return typedSuggestion;
      }
    }

    // Type-specific generation
    switch (videoType) {
      case 'tutorial':
        return `Step ${patterns.nextNumber}`;
      
      case 'lecture':
        if (timestamp < 300) return 'Introduction';
        if (timestamp > totalDuration * 0.8) return 'Q&A / Summary';
        return `Topic ${patterns.nextNumber}`;
      
      case 'music':
        return `Track ${patterns.nextNumber}`;
      
      case 'interview':
        if (timestamp < 300) return 'Introduction';
        if (timestamp > totalDuration * 0.8) return 'Closing Remarks';
        return `Question ${patterns.nextNumber}`;
      
      case 'gaming':
        return `Level ${patterns.nextNumber}`;
      
      case 'review':
        return `Feature ${patterns.nextNumber}`;
      
      default:
        return `Chapter ${patterns.nextNumber}`;
    }
  }

  /**
   * Get typed suggestion based on video type
   * @param {Array} suggestions - Array of suggestion options
   * @param {string} videoType - Video type
   * @param {number} nextNumber - Next sequential number
   * @returns {string} Typed suggestion
   */
  function getTypedSuggestion(suggestions, videoType, nextNumber) {
    const suggestion = suggestions[0]; // Use first suggestion
    
    switch (videoType) {
      case 'tutorial':
        return suggestion === 'Introduction' ? 'Getting Started' : `${suggestion} - Step ${nextNumber}`;
      case 'lecture':
        return suggestion === 'Introduction' ? 'Course Introduction' : `${suggestion} - Part ${nextNumber}`;
      case 'music':
        return `${suggestion} - Track ${nextNumber}`;
      default:
        return `${suggestion} - Chapter ${nextNumber}`;
    }
  }

  /**
   * Generate smart title for a marker
   * @param {Object} options - Generation options
   * @param {string} options.videoTitle - Video title
   * @param {string} options.url - Video URL
   * @param {number} options.timestamp - Marker timestamp in seconds
   * @param {number} options.totalDuration - Total video duration (optional)
   * @param {Array} options.existingMarkers - Existing markers for pattern detection
   * @returns {string} Generated title
   */
  function generateTitle(options) {
    const {
      videoTitle,
      url,
      timestamp,
      totalDuration = 3600, // Default 1 hour if not provided
      existingMarkers = []
    } = options;

    try {
      // Classify video type
      const videoType = classifyVideoType(videoTitle, url);
      
      // Analyze video title for context
      const videoAnalysis = analyzeVideoTitle(videoTitle);
      
      // Analyze existing marker patterns
      const patterns = analyzeMarkerPatterns(existingMarkers);
      
      // Generate title based on all context
      const generatedTitle = generateTitleByType(
        videoType,
        timestamp,
        totalDuration,
        patterns,
        videoAnalysis
      );

      return generatedTitle;

    } catch (error) {
      console.error('Title generation error:', error);
      // Fallback to simple pattern
      return `Marker at ${formatTimestamp(timestamp)}`;
    }
  }

  /**
   * Format timestamp for display
   * @param {number} seconds - Timestamp in seconds
   * @returns {string} Formatted timestamp
   */
  function formatTimestamp(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get title suggestions for user to choose from
   * @param {Object} options - Same as generateTitle options
   * @returns {Array} Array of suggested titles
   */
  function getTitleSuggestions(options) {
    const primary = generateTitle(options);
    const suggestions = [primary];

    // Add alternative suggestions
    const { timestamp, totalDuration = 3600, existingMarkers = [] } = options;
    const patterns = analyzeMarkerPatterns(existingMarkers);
    
    // Add numbered alternatives
    if (!primary.includes(patterns.nextNumber.toString())) {
      suggestions.push(`Chapter ${patterns.nextNumber}`);
      suggestions.push(`Part ${patterns.nextNumber}`);
    }

    // Add timestamp-based alternative
    suggestions.push(`Marker at ${formatTimestamp(timestamp)}`);

    // Add context-based alternatives
    if (timestamp < 300) {
      suggestions.push('Introduction');
    } else if (timestamp > totalDuration * 0.8) {
      suggestions.push('Conclusion');
    } else {
      suggestions.push('Main Content');
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  return {
    generateTitle,
    getTitleSuggestions,
    classifyVideoType,
    analyzeMarkerPatterns
  };

})();