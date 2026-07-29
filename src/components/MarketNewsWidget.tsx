import React, { useState, useEffect, useCallback } from 'react';
import { MarketNewsArticle } from '../types';
import { Globe, RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus, Sparkles, Newspaper } from 'lucide-react';

interface MarketNewsWidgetProps {
  selectedSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
}

export const MarketNewsWidget: React.FC<MarketNewsWidgetProps> = ({ selectedSymbol, onSelectSymbol }) => {
  const [articles, setArticles] = useState<MarketNewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterSentiment, setFilterSentiment] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL'>('ALL');
  const [isGrounded, setIsGrounded] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/market-news');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.articles)) {
          setArticles(data.articles);
          setIsGrounded(!!data.groundingGrounded);
          setLastUpdated(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch market news:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    // Auto refresh news every 3 minutes
    const interval = setInterval(() => {
      fetchNews();
    }, 180000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const filteredArticles = articles.filter((a) => {
    if (filterSentiment !== 'ALL' && a.sentiment !== filterSentiment) return false;
    return true;
  });

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
            <TrendingUp className="w-3.5 h-3.5" />
            Бычий
          </span>
        );
      case 'BEARISH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <TrendingDown className="w-3.5 h-3.5" />
            Медвежий
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Minus className="w-3.5 h-3.5" />
            Нейтральный
          </span>
        );
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 shadow-2xl mb-6 flex flex-col h-full border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Newspaper className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white">Новости и Контекст Рынка</h2>
              {isGrounded && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-500/30 shadow-sm" title="Использует заземление Google Search Grounding для проверки фактов в реальном времени">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  Google Search Grounded
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-neutral-400">
              Сводка новостей для понимания причин рыночных сдвигов
              {lastUpdated && ` • Обновлено в ${lastUpdated}`}
            </p>
          </div>
        </div>

        <button
          onClick={fetchNews}
          disabled={loading}
          className="p-2 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl border border-white/10 transition disabled:opacity-50"
          title="Обновить новости"
        >
          <RefreshCw className={`w-4 h-4 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 text-xs sm:text-sm">
        <button
          onClick={() => setFilterSentiment('ALL')}
          className={`px-3 py-1.5 rounded-xl font-medium transition ${
            filterSentiment === 'ALL'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
              : 'bg-white/5 text-neutral-400 hover:text-white border border-transparent'
          }`}
        >
          Все ({articles.length})
        </button>
        <button
          onClick={() => setFilterSentiment('BULLISH')}
          className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
            filterSentiment === 'BULLISH'
              ? 'bg-green-500/20 text-green-300 border border-green-500/40 font-semibold'
              : 'bg-white/5 text-neutral-400 hover:text-white border border-transparent'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-green-400" />
          Бычьи
        </button>
        <button
          onClick={() => setFilterSentiment('BEARISH')}
          className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
            filterSentiment === 'BEARISH'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold'
              : 'bg-white/5 text-neutral-400 hover:text-white border border-transparent'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          Медвежьи
        </button>
        <button
          onClick={() => setFilterSentiment('NEUTRAL')}
          className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
            filterSentiment === 'NEUTRAL'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold'
              : 'bg-white/5 text-neutral-400 hover:text-white border border-transparent'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          Нейтральные
        </button>
      </div>

      {/* Articles Feed */}
      {loading && articles.length === 0 ? (
        <div className="py-12 text-center text-sm text-neutral-400 flex flex-col items-center justify-center gap-2">
          <Globe className="w-6 h-6 text-cyan-400 animate-spin" />
          <span>Загрузка свежих новостей и проверка фактов через Google Search...</span>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="py-8 text-center text-sm text-neutral-400">
          Новостей по данному фильтру не найдено.
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto max-h-[550px] pr-1">
          {filteredArticles.map((article) => (
            <div
              key={article.id}
              className="bg-black/40 hover:bg-black/60 rounded-xl p-4 border border-white/5 hover:border-cyan-500/30 transition shadow-sm space-y-2.5 group"
            >
              {/* Top Meta Line */}
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <span
                    onClick={() => onSelectSymbol && article.symbol !== 'MARKET' && onSelectSymbol(`${article.symbol}/USDT`)}
                    className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-md border ${
                      selectedSymbol && selectedSymbol.includes(article.symbol)
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-white/5 text-neutral-300 border-white/10 hover:border-cyan-500/40 cursor-pointer'
                    }`}
                  >
                    {article.symbol}
                  </span>
                  {getSentimentBadge(article.sentiment)}
                </div>
                <span className="text-xs text-neutral-400 font-mono">{article.timeAgo}</span>
              </div>

              {/* Title */}
              <h3 className="text-sm sm:text-base font-bold text-neutral-100 group-hover:text-cyan-300 transition leading-snug">
                {article.title}
              </h3>

              {/* Summary */}
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                {article.summary}
              </p>

              {/* AI Market Context Explanation */}
              {article.impactExplanation && (
                <div className="bg-cyan-950/30 rounded-lg p-2.5 border border-cyan-500/20 text-xs sm:text-sm text-cyan-200/90 flex gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-cyan-300">Контекст AI Трейдера: </span>
                    {article.impactExplanation}
                  </div>
                </div>
              )}

              {/* Grounding Source Links */}
              {article.sources && article.sources.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                  <span>Источники:</span>
                  {article.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline max-w-[220px] truncate"
                      title={src.title}
                    >
                      <span>{src.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
