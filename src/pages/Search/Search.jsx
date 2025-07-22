import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Clock, 
  Music, 
  Filter,
  Loader2,
  Sparkles,
  Radio,
  Mic2,
  Star,
  Heart,
  Play
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
    setSearchHistory(history.slice(0, 8));
  };

  const loadSuggestions = async () => {
    try {
      const trending = [
        'Bollywood hits',
        'Latest songs',
        'Romantic songs',
        'Party music',
        'Workout playlist',
        'Chill vibes',
        'Top 40',
        'Indie music'
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
    setSearchHistory(newHistory.slice(0, 8));
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    performSearch(suggestion);
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
        {!hasSearched ? (
          /* Browse Section - FULL WIDTH USAGE */
          <div className="browse-section">
            <div className="browse-header">
              <div className="header-content">
                <h1>Browse all</h1>
                <p>Discover new music and find your favorites</p>
              </div>
            </div>

            <div className="browse-content">
              {/* Search History */}
              {searchHistory.length > 0 && (
                <div className="history-section">
                  <div className="section-header">
                    <h2>Recent searches</h2>
                  </div>
                  <div className="history-grid">
                    {searchHistory.map((item, index) => (
                      <button
                        key={index}
                        className="history-item"
                        onClick={() => handleSuggestionClick(item)}
                      >
                        <div className="history-icon">
                          <Clock size={20} />
                        </div>
                        <span>{item}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Suggestions */}
              <div className="suggestions-section">
                <div className="section-header">
                  <h2>Trending searches</h2>
                </div>
                <div className="suggestions-grid">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="suggestion-card"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <div className="suggestion-icon">
                        <TrendingUp size={24} />
                      </div>
                      <div className="suggestion-content">
                        <span className="suggestion-title">{suggestion}</span>
                        <span className="suggestion-subtitle">Popular now</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Browse Categories */}
              <div className="categories-section">
                <div className="section-header">
                  <h2>Browse by genre</h2>
                </div>
                <div className="categories-grid">
                  {[
                    { name: 'Bollywood', color: '#ff6b6b', icon: Mic2 },
                    { name: 'Pop', color: '#4ecdc4', icon: Radio },
                    { name: 'Rock', color: '#45b7d1', icon: Music },
                    { name: 'Hip Hop', color: '#f9ca24', icon: Mic2 },
                    { name: 'Electronic', color: '#6c5ce7', icon: Radio },
                    { name: 'Classical', color: '#a29bfe', icon: Music },
                    { name: 'Jazz', color: '#fd79a8', icon: Music },
                    { name: 'Country', color: '#fdcb6e', icon: Radio },
                    { name: 'R&B', color: '#e17055', icon: Mic2 },
                    { name: 'Indie', color: '#00b894', icon: Music }
                  ].map((category, index) => (
                    <button
                      key={index}
                      className="category-card"
                      style={{ backgroundColor: category.color }}
                      onClick={() => handleSuggestionClick(category.name)}
                    >
                      <span className="category-name">{category.name}</span>
                      <div className="category-icon">
                        <category.icon size={32} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Results Section - FULL WIDTH USAGE */
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
                    <h1>Search results for "{query}"</h1>
                    <div className="results-stats">
                      <span>{results.length} songs found</span>
                      {playableCount > 0 && <span>• {playableCount} available</span>}
                      {unavailableCount > 0 && <span>• {unavailableCount} coming soon</span>}
                    </div>
                  </div>

                  {/* Filter Buttons */}
                  {results.length > 0 && (
                    <div className="filter-section">
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
                            <Play size={16} />
                            Available ({playableCount})
                          </button>
                        )}
                        {unavailableCount > 0 && (
                          <button
                            className={`filter-btn ${activeFilter === 'unavailable' ? 'active' : ''}`}
                            onClick={() => setActiveFilter('unavailable')}
                          >
                            <Clock size={16} />
                            Coming Soon ({unavailableCount})
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Results Content - SCROLLABLE WHEN OVERFLOW */}
                <div className="results-content">
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
                      <h3>Searching for the best music...</h3>
                      <p>Finding tracks that match your taste</p>
                    </div>
                  ) : filteredResults.length > 0 ? (
                    <div className="tracks-container">
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
                    </div>
                  ) : (
                    <div className="no-results">
                      <div className="no-results-content">
                        <div className="no-results-icon">
                          <Music size={64} />
                        </div>
                        <h3>No results found for "{query}"</h3>
                        <p>Try different keywords or check your spelling</p>
                        <div className="suggestions">
                          <p>Try searching for:</p>
                          <div className="suggestion-chips">
                            {suggestions.slice(0, 4).map((suggestion, index) => (
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
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;