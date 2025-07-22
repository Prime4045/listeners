import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search as SearchIcon, 
  TrendingUp, 
  Clock, 
  Music, 
  Filter,
  X,
  Loader2,
  Sparkles,
  Radio,
  Mic2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicContext';
import TrackList from '../../components/TrackList';
import ApiService from '../../services/api';
import './Search.css';

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { playTrack } = useMusic();
  
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      performSearch(debouncedQuery.trim());
    } else {
      setResults([]);
      setHasSearched(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery) {
      setQuery(initialQuery);
      setHasSearched(true);
    }
    loadSearchHistory();
    loadSuggestions();
  }, []);

  const loadSearchHistory = () => {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    setSearchHistory(history.slice(0, 5));
  };

  const loadSuggestions = async () => {
    try {
      // Load trending searches or popular terms
      const trending = [
        'Bollywood hits',
        'Latest songs',
        'Romantic songs',
        'Party music',
        'Workout playlist'
      ];
      setSuggestions(trending);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const performSearch = async (searchQuery) => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setHasSearched(true);

      const response = await ApiService.searchMusic(searchQuery, 50);
      setResults(response.songs || []);

      // Update URL
      setSearchParams({ q: searchQuery });

      // Save to search history
      saveToHistory(searchQuery);

    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const saveToHistory = (searchQuery) => {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    const newHistory = [searchQuery, ...history.filter(item => item !== searchQuery)].slice(0, 10);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    setSearchHistory(newHistory.slice(0, 5));
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      performSearch(query.trim());
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    performSearch(suggestion);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setSearchParams({});
  };

  const filteredResults = results.filter(track => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'playable') return track.canPlay;
    if (activeFilter === 'unavailable') return !track.canPlay;
    return true;
  });

  const playableCount = results.filter(track => track.canPlay).length;
  const unavailableCount = results.filter(track => !track.canPlay).length;

  return (
    <div className="search-page">
      <div className="search-container">
        {/* Search Header */}
        <div className="search-header">
          <form onSubmit={handleSearchSubmit} className="search-form">
            <div className="search-input-container">
              <SearchIcon className="search-icon" size={20} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What do you want to listen to?"
                className="search-input"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  className="clear-btn"
                  onClick={clearSearch}
                >
                  <X size={16} />
                </button>
              )}
              {loading && (
                <div className="search-loading">
                  <Loader2 className="animate-spin" size={16} />
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Search Content */}
        <div className="search-content">
          {!hasSearched ? (
            /* Browse Section */
            <div className="browse-section">
              <div className="section-header">
                <h2>Browse all</h2>
              </div>

              {/* Search History */}
              {searchHistory.length > 0 && (
                <div className="history-section">
                  <h3>Recent searches</h3>
                  <div className="history-list">
                    {searchHistory.map((item, index) => (
                      <button
                        key={index}
                        className="history-item"
                        onClick={() => handleSuggestionClick(item)}
                      >
                        <Clock size={16} />
                        <span>{item}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              <div className="suggestions-section">
                <h3>Try something like</h3>
                <div className="suggestions-grid">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="suggestion-card"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <div className="suggestion-icon">
                        <Music size={24} />
                      </div>
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Browse Categories */}
              <div className="categories-section">
                <h3>Browse by genre</h3>
                <div className="categories-grid">
                  {[
                    { name: 'Bollywood', color: '#ff6b6b', icon: Mic2 },
                    { name: 'Pop', color: '#4ecdc4', icon: Radio },
                    { name: 'Rock', color: '#45b7d1', icon: Music },
                    { name: 'Hip Hop', color: '#f9ca24', icon: Mic2 },
                    { name: 'Electronic', color: '#6c5ce7', icon: Radio },
                    { name: 'Classical', color: '#a29bfe', icon: Music }
                  ].map((category, index) => (
                    <button
                      key={index}
                      className="category-card"
                      style={{ backgroundColor: category.color }}
                      onClick={() => handleSuggestionClick(category.name)}
                    >
                      <span>{category.name}</span>
                      <category.icon size={32} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Results Section */
            <div className="results-section">
              {error ? (
                <div className="error-state">
                  <div className="error-content">
                    <Sparkles size={48} />
                    <h3>Something went wrong</h3>
                    <p>{error}</p>
                    <button onClick={() => performSearch(query)} className="retry-btn">
                      Try again
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Results Header */}
                  <div className="results-header">
                    <div className="results-info">
                      <h2>Search results for "{query}"</h2>
                      <p>
                        {results.length} songs found
                        {playableCount > 0 && ` • ${playableCount} available`}
                        {unavailableCount > 0 && ` • ${unavailableCount} coming soon`}
                      </p>
                    </div>

                    {/* Filter Buttons */}
                    {results.length > 0 && (
                      <div className="filter-buttons">
                        <button
                          className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                          onClick={() => setActiveFilter('all')}
                        >
                          All ({results.length})
                        </button>
                        {playableCount > 0 && (
                          <button
                            className={`filter-btn ${activeFilter === 'playable' ? 'active' : ''}`}
                            onClick={() => setActiveFilter('playable')}
                          >
                            Available ({playableCount})
                          </button>
                        )}
                        {unavailableCount > 0 && (
                          <button
                            className={`filter-btn ${activeFilter === 'unavailable' ? 'active' : ''}`}
                            onClick={() => setActiveFilter('unavailable')}
                          >
                            Coming Soon ({unavailableCount})
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Results List */}
                  {loading ? (
                    <div className="loading-results">
                      <div className="loading-animation">
                        <div className="music-wave">
                          <div className="wave-bar"></div>
                          <div className="wave-bar"></div>
                          <div className="wave-bar"></div>
                          <div className="wave-bar"></div>
                          <div className="wave-bar"></div>
                        </div>
                      </div>
                      <p>Searching for the best music...</p>
                    </div>
                  ) : filteredResults.length > 0 ? (
                    <TrackList
                      tracks={filteredResults}
                      onAuthRequired={() => navigate('/signin')}
                      onLikeSong={async (song) => {
                        try {
                          await ApiService.likeTrack(song.spotifyId);
                        } catch (error) {
                          console.error('Failed to like song:', error);
                        }
                      }}
                      onAddToLibrary={async (song) => {
                        try {
                          await ApiService.addToLibrary(song.spotifyId);
                        } catch (error) {
                          console.error('Failed to add to library:', error);
                        }
                      }}
                      isAuthenticated={isAuthenticated}
                      searchQuery={query}
                    />
                  ) : (
                    <div className="no-results">
                      <div className="no-results-content">
                        <SearchIcon size={64} />
                        <h3>No results found for "{query}"</h3>
                        <p>Try different keywords or check your spelling</p>
                        <div className="suggestions">
                          <p>Try searching for:</p>
                          <div className="suggestion-chips">
                            {suggestions.slice(0, 3).map((suggestion, index) => (
                              <button
                                key={index}
                                className="suggestion-chip"
                                onClick={() => handleSuggestionClick(suggestion)}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;