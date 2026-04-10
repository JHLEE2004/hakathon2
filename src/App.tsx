import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  onSnapshot, 
  query,
  getDocFromCache,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

// Article Type
interface Article {
  id: string;
  title: string;
  category: string;
  summary: string;
  author: string;
  readTime: string;
  imageUrl: string;
  articleUrl: string;
}

export default function App() {
  // --- State ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedArticles, setSavedArticles] = useState<Record<string, any>>({});
  const [view, setView] = useState<'home' | 'saved' | 'market'>('home');
  const [selectedIndices, setSelectedIndices] = useState<string[]>([]);
  const [darkMode, setDarkMode] = useState(false);

  // --- Dark Mode Effect ---
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // --- Auth Observer ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });

    // Connection Test
    const testConnection = async () => {
      try {
        // Try to fetch a non-existent doc to test connection
        await getDocFromServer(doc(db, '_connection_test', 'ping'));
        console.log("Firestore connection successful.");
      } catch (error: any) {
        if (error.message?.includes('the client is offline')) {
          console.error("Firestore connection failed: Please check your Firebase configuration.");
          setError("Database connection error. Please try again later.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  // --- Firestore Real-time Sync ---
  useEffect(() => {
    if (!user) {
      setSavedArticles({});
      return;
    }

    const path = `users/${user.uid}/savedArticles`;
    const q = query(collection(db, path));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const articles: Record<string, any> = {};
      snapshot.forEach((doc) => {
        articles[doc.id] = doc.data();
      });
      setSavedArticles(articles);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user]);

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // --- Handlers ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (authMode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        
        const finalDisplayName = displayName || email.split('@')[0];

        // 1. Update Firebase Auth Profile
        await updateProfile(newUser, {
          displayName: finalDisplayName
        });

        // 2. Create user profile in Firestore
        const userPath = `users/${newUser.uid}`;
        await setDoc(doc(db, userPath), {
          displayName: finalDisplayName,
          email: email,
          createdAt: new Date().toISOString()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setShowAuthModal(false);
      resetAuthForm();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const resetAuthForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError(null);
  };

  const toggleSaveArticle = async (article: Article) => {
    if (!user) {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    const path = `users/${user.uid}/savedArticles/${article.id}`;
    try {
      if (savedArticles[article.id]) {
        await deleteDoc(doc(db, path));
      } else {
        await setDoc(doc(db, path), {
          ...article,
          savedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const isSaved = (id: string) => !!savedArticles[id];

  // --- Article Data ---
  const leadArticle: Article = {
    id: 'wsj-iran-crypto',
    title: "Iran’s $7.8 Billion Crypto Economy Finds New Way to Grow After Cease-Fire",
    category: 'Cryptocurrency',
    summary: 'Iran is demanding oil tankers passing through the Strait of Hormuz pay a toll in cryptocurrency, highlighting its importance to the Iranian regime and economy.',
    author: 'Vicky Ge Huang and Benoit Faucon',
    readTime: '7 min read',
    imageUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&q=80&w=1200&h=800',
    articleUrl: 'https://www.wsj.com/finance/currencies/iran-cryptocurrency-bitcoin-d8c0a09e?reflink=desktopwebshare_permalink'
  };

  const fedRateArticle: Article = {
    id: 'cnbc-fed-hike',
    title: "Markets see Fed's next move as potential hike as oil prices, inflation fears rise",
    category: 'Economy',
    summary: 'Traders in the futures market shifted the probability of a rate increase by the end of 2026 to 52% on Friday morning as inflation fears mount.',
    author: 'Jeff Cox',
    readTime: '5 min read',
    imageUrl: 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&q=80&w=800&h=600',
    articleUrl: 'https://www.cnbc.com/2026/03/27/markets-see-the-feds-next-move-as-a-potential-hike-as-oil-prices-inflation-fears-rise.html'
  };

  const goldPriceArticle: Article = {
    id: 'bbc-gold-price',
    title: "What's going on with the price of gold?",
    category: 'Business',
    summary: 'Gold has fallen from recent highs but there are several reasons investors are still finding refuge in the precious metal amid global uncertainty.',
    author: 'BBC News',
    readTime: '4 min read',
    imageUrl: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&q=80&w=800&h=600',
    articleUrl: 'https://bbc.com/news/articles/c87r2700dq8o'
  };

  // --- UI Helpers ---
  const userInitial = user?.email?.[0].toUpperCase() || 'JS';
  const savedCount = Object.keys(savedArticles).length;

  return (
    <div className="bg-surface dark:bg-surface-dark text-on-surface dark:text-on-surface-dark min-h-screen transition-colors duration-300">
      {/* Market Ticker */}
      <div className="w-full bg-[#e8e8e8] dark:bg-zinc-800 h-8 flex items-center overflow-x-hidden border-b border-outline/10">
        <div className="animate-ticker flex items-center gap-12 px-6 whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <React.Fragment key={i}>
              <span className="text-[11px] font-label uppercase tracking-widest text-[#44636e] dark:text-slate-400 font-bold shrink-0">Market Data</span>
              <span className="text-[11px] font-label uppercase tracking-widest text-black dark:text-white cursor-pointer hover:underline shrink-0">KOSPI <span className="text-green-600">+0.82%</span></span>
              <span className="text-[11px] font-label uppercase tracking-widest text-black dark:text-white cursor-pointer hover:underline shrink-0">KOSDAQ <span className="text-red-600">-0.15%</span></span>
              <span className="text-[11px] font-label uppercase tracking-widest text-black dark:text-white cursor-pointer hover:underline shrink-0">GOLD <span className="text-green-600">+1.24%</span></span>
              <span className="text-[11px] font-label uppercase tracking-widest text-black dark:text-white cursor-pointer hover:underline shrink-0">SILVER <span className="text-green-600">+0.56%</span></span>
              <span className="text-[11px] font-label uppercase tracking-widest text-black dark:text-white cursor-pointer hover:underline shrink-0">NAT GAS <span className="text-red-600">-2.10%</span></span>
              <span className="text-[11px] font-label uppercase tracking-widest text-black dark:text-white cursor-pointer hover:underline shrink-0">DOW <span className="text-green-600">+0.45%</span></span>
              <span className="text-[11px] font-label uppercase tracking-widest text-slate-600 dark:text-slate-400 cursor-pointer hover:underline shrink-0">S&P 500 <span className="text-red-600">-0.12%</span></span>
              <span className="text-[11px] font-label uppercase tracking-widest text-slate-600 dark:text-slate-400 cursor-pointer hover:underline shrink-0">NASDAQ <span className="text-green-600">+1.02%</span></span>
              <span className="text-[11px] font-label uppercase tracking-widest text-slate-600 dark:text-slate-400 cursor-pointer hover:underline shrink-0">DAX <span className="text-green-600">+0.18%</span></span>
              <span className="text-[11px] font-label uppercase tracking-widest text-slate-600 dark:text-slate-400 cursor-pointer hover:underline shrink-0">NIKKEI 225 <span className="text-red-600">-0.05%</span></span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Top Navigation Bar */}
      <header className="bg-[#f9f9f9] dark:bg-zinc-900 border-b-0 sticky top-0 z-50">
        <div className="flex flex-col w-full px-6 py-4 max-w-[1440px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4 w-1/3">
              <button className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors duration-150">
                <span className="material-symbols-outlined">menu</span>
              </button>
              <div className="relative hidden md:block">
                <input className="bg-surface-container-high border-none text-sm px-4 py-3 w-48 focus:ring-1 focus:ring-primary" placeholder="Search Markets..." type="text"/>
              </div>
            </div>
            <div className="w-1/3 flex justify-center">
              <h1 
                onClick={() => setView('home')}
                className="text-4xl font-headline italic text-black dark:text-white uppercase tracking-tighter font-serif cursor-pointer text-center whitespace-nowrap"
              >
                Chungjeong Street Journal
              </h1>
            </div>
            <div className="flex items-center justify-end gap-4 w-1/3">
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors duration-150"
                title="Toggle Dark Mode"
              >
                <span className="material-symbols-outlined">
                  {darkMode ? 'light_mode' : 'dark_mode'}
                </span>
              </button>
              {!user ? (
                <>
                  <button 
                    onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                    className="text-slate-700 dark:text-slate-300 font-medium hover:text-black dark:hover:text-white transition-colors text-sm px-4 py-2"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}
                    className="bg-black hover:bg-zinc-800 text-white font-bold px-6 py-2 transition-all duration-100 ease-in-out active:scale-95"
                  >
                    Join Now
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleLogout}
                  className="text-slate-700 dark:text-slate-300 font-medium hover:text-black dark:hover:text-white transition-colors text-sm px-4 py-2"
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
          <nav className="flex justify-center gap-8 border-t border-outline/10 pt-4">
            <a className="text-[#D60000] border-b-2 border-[#D60000] pb-1 font-bold text-sm uppercase tracking-wide" href="#">Markets</a>
            <a className="text-slate-700 dark:text-slate-300 font-medium hover:text-black dark:hover:text-white transition-colors text-sm uppercase tracking-wide" href="#">Politics</a>
            <a className="text-slate-700 dark:text-slate-300 font-medium hover:text-black dark:hover:text-white transition-colors text-sm uppercase tracking-wide" href="#">Tech</a>
            <a className="text-slate-700 dark:text-slate-300 font-medium hover:text-black dark:hover:text-white transition-colors text-sm uppercase tracking-wide" href="#">Opinion</a>
            <a className="text-slate-700 dark:text-slate-300 font-medium hover:text-black dark:hover:text-white transition-colors text-sm uppercase tracking-wide" href="#">Real Estate</a>
            <a className="text-slate-700 dark:text-slate-300 font-medium hover:text-black dark:hover:text-white transition-colors text-sm uppercase tracking-wide" href="#">Life</a>
          </nav>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-12">
        {view === 'home' ? (
          <div className="grid grid-cols-12 gap-12">
            {/* Left Column: News Feed */}
            <div className="col-span-12 lg:col-span-8 space-y-16">
              {/* Lead Story */}
              <section className="group cursor-pointer relative">
                <a href={leadArticle.articleUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col md:flex-row gap-8">
                  <div className="md:w-3/5">
                    <span className="text-primary font-bold text-[10px] uppercase tracking-widest block mb-2">{leadArticle.category}</span>
                    <h2 className="text-5xl font-serif font-bold leading-tight mb-4 group-hover:text-primary transition-colors">{leadArticle.title}</h2>
                    <p className="text-body-md text-secondary leading-relaxed mb-6 font-body">{leadArticle.summary}</p>
                    <div className="flex items-center gap-4 text-xs font-label text-on-surface-variant/60">
                      <span>By {leadArticle.author}</span>
                      <span>•</span>
                      <span>{leadArticle.readTime}</span>
                    </div>
                  </div>
                  <div className="md:w-2/5 relative">
                    <img src={leadArticle.imageUrl} alt={leadArticle.title} className="w-full h-full object-cover transition-all duration-500" referrerPolicy="no-referrer" />
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSaveArticle(leadArticle); }}
                      className={`absolute top-2 right-2 material-symbols-outlined bg-white/80 p-1 transition-all duration-300 active:scale-150 text-base ${isSaved(leadArticle.id) ? 'text-[#D60000] fill-1' : 'text-secondary hover:text-[#D60000]'}`}
                      style={{ fontVariationSettings: `'FILL' ${isSaved(leadArticle.id) ? 1 : 0}` }}
                    >
                      bookmark
                    </button>
                  </div>
                </a>
              </section>

              {/* News Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <article className="space-y-4 group relative">
                  <a href={fedRateArticle.articleUrl} target="_blank" rel="noopener noreferrer" className="block space-y-4">
                    <div className="relative">
                      <img src={fedRateArticle.imageUrl} alt={fedRateArticle.title} className="w-full aspect-[16/9] object-cover" referrerPolicy="no-referrer" />
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSaveArticle(fedRateArticle); }}
                        className={`absolute top-2 right-2 material-symbols-outlined bg-white/80 p-1 transition-all duration-300 active:scale-150 text-base ${isSaved(fedRateArticle.id) ? 'text-[#D60000]' : 'text-secondary hover:text-[#D60000]'}`}
                        style={{ fontVariationSettings: `'FILL' ${isSaved(fedRateArticle.id) ? 1 : 0}` }}
                      >
                        bookmark
                      </button>
                    </div>
                    <span className="text-secondary font-bold text-[10px] uppercase tracking-widest block">{fedRateArticle.category}</span>
                    <h3 className="text-2xl font-serif font-bold group-hover:text-primary transition-colors">{fedRateArticle.title}</h3>
                    <p className="text-sm text-on-surface-variant font-body">{fedRateArticle.summary}</p>
                  </a>
                </article>

                <article className="space-y-4 group relative">
                  <a href={goldPriceArticle.articleUrl} target="_blank" rel="noopener noreferrer" className="block space-y-4">
                    <div className="relative">
                      <img src={goldPriceArticle.imageUrl} alt={goldPriceArticle.title} className="w-full aspect-[16/9] object-cover" referrerPolicy="no-referrer" />
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSaveArticle(goldPriceArticle); }}
                        className={`absolute top-2 right-2 material-symbols-outlined bg-white/80 p-1 transition-all duration-300 active:scale-150 text-base ${isSaved(goldPriceArticle.id) ? 'text-[#D60000]' : 'text-secondary hover:text-[#D60000]'}`}
                        style={{ fontVariationSettings: `'FILL' ${isSaved(goldPriceArticle.id) ? 1 : 0}` }}
                      >
                        bookmark
                      </button>
                    </div>
                    <span className="text-secondary font-bold text-[10px] uppercase tracking-widest block">{goldPriceArticle.category}</span>
                    <h3 className="text-2xl font-serif font-bold group-hover:text-primary transition-colors">{goldPriceArticle.title}</h3>
                    <p className="text-sm text-on-surface-variant font-body">{goldPriceArticle.summary}</p>
                  </a>
                </article>
              </div>

              <div className="bg-surface-container-low dark:bg-surface-container-low-dark p-8">
                <h4 className="text-xl font-headline font-bold mb-6 border-b border-outline/10 pb-2 italic">The Morning Briefing</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <span className="text-xs font-label text-primary font-bold">01</span>
                    <p className="text-sm font-headline font-medium mt-2">Energy prices stabilize as supply chain bottlenecks finally ease in Pacific routes.</p>
                  </div>
                  <div>
                    <span className="text-xs font-label text-primary font-bold">02</span>
                    <p className="text-sm font-headline font-medium mt-2">Consumer sentiment hits two-year high despite lingering interest rate concerns.</p>
                  </div>
                  <div>
                    <span className="text-xs font-label text-primary font-bold">03</span>
                    <p className="text-sm font-headline font-medium mt-2">Global travel luxury sector reports unprecedented growth in Q4 earnings calls.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Sidebar */}
            <aside className="col-span-12 lg:col-span-4 space-y-12">
              {/* Member Area */}
              <section className="bg-surface-container-lowest dark:bg-surface-container-lowest-dark p-8 border border-outline/10 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-headline font-bold">My Workspace</h3>
                    <p className="text-[10px] font-label text-on-surface-variant/60 uppercase tracking-widest">
                      {user ? `Welcome, ${user.email?.split('@')[0]}` : 'Premium Member Portal'}
                    </p>
                  </div>
                  <div className="h-10 w-10 bg-secondary flex items-center justify-center text-white font-bold">
                    {userInitial}
                  </div>
                </div>
                <div className="space-y-6">
                  <div 
                    onClick={() => setView('saved')}
                    className="flex items-center justify-between group cursor-pointer border-b border-outline/5 pb-4"
                  >
                    <div>
                      <h4 className="text-sm font-body font-bold group-hover:text-primary transition-colors">Saved Articles</h4>
                      <p className="text-xs text-on-surface-variant/60 font-label">
                        {user ? `${savedCount} stories waiting to be read` : 'Sign in to see your saved stories'}
                      </p>
                    </div>
                    <span className={`material-symbols-outlined ${savedCount > 0 ? 'text-primary' : 'text-secondary'}`} style={{ fontVariationSettings: `'FILL' ${savedCount > 0 ? 1 : 0}` }}>bookmark</span>
                  </div>
                  <div className="flex items-center justify-between group cursor-pointer border-b border-outline/5 pb-4">
                    <div>
                      <h4 className="text-sm font-body font-bold group-hover:text-primary transition-colors">My Scraps</h4>
                      <p className="text-xs text-on-surface-variant/60 font-label">Notes from recent investigations</p>
                    </div>
                    <span className="material-symbols-outlined text-secondary">edit_note</span>
                  </div>
                  <div 
                    onClick={() => setView('market')}
                    className="flex items-center justify-between group cursor-pointer border-b border-outline/5 pb-4"
                  >
                    <div>
                      <h4 className="text-sm font-body font-bold group-hover:text-primary transition-colors">Market Index Tracker</h4>
                      <p className="text-xs text-on-surface-variant/60 font-label">Track your preferred global indices</p>
                    </div>
                    <span className="material-symbols-outlined text-secondary">trending_up</span>
                  </div>
                </div>
                <button className="w-full mt-8 border border-secondary text-secondary hover:bg-secondary hover:text-white py-3 font-bold transition-colors uppercase text-xs tracking-widest">
                  View All Activity
                </button>
              </section>

              {/* Most Popular */}
              <section className="space-y-6">
                <h3 className="text-lg font-headline font-bold uppercase tracking-tight border-b border-black pb-2">Most Read Today</h3>
                <div className="space-y-8">
                  {[
                    { num: '01', title: 'Why Silicon Valley is Betting Everything on Vertical Farming', cat: 'Tech' },
                    { num: '02', title: 'The Secret Tax Haven Hiding in Plain Sight in the Alps', cat: 'World Finance' },
                    { num: '03', title: 'A 10-Step Guide to Reclaiming Your Focus in the Notification Age', cat: 'Lifestyle' }
                  ].map((item) => (
                    <div key={item.num} className="flex gap-4">
                      <span className="text-3xl font-headline text-surface-container-highest font-black">{item.num}</span>
                      <div>
                        <h4 className="text-md font-headline font-bold leading-tight cursor-pointer hover:text-primary">{item.title}</h4>
                        <p className="text-xs text-on-surface-variant/60 mt-1 uppercase">{item.cat}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Newsletter */}
              <section className="bg-black text-white p-8">
                <h3 className="text-2xl font-headline font-bold mb-4">Precision Daily</h3>
                <p className="text-xs text-slate-400 mb-6 font-body leading-relaxed">The only newsletter that curates the signal from the noise. Delivered at 6 AM EST daily.</p>
                <div className="space-y-4">
                  <input className="w-full bg-zinc-900 border-zinc-800 text-sm focus:ring-primary focus:border-primary" placeholder="Email Address" type="email"/>
                  <button className="w-full bg-white text-black font-bold py-3 text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors">Subscribe Now</button>
                </div>
              </section>
            </aside>
          </div>
        ) : view === 'saved' ? (
          <div className="space-y-12">
            <div className="flex items-center gap-4 border-b border-outline/10 pb-6">
              <button 
                onClick={() => setView('home')}
                className="material-symbols-outlined text-secondary hover:text-primary transition-colors"
              >
                arrow_back
              </button>
              <h2 className="text-4xl font-headline font-bold">Saved Articles</h2>
            </div>

            {Object.keys(savedArticles).length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <span className="material-symbols-outlined text-6xl text-outline/20">bookmark</span>
                <p className="text-on-surface-variant/60 font-body">You haven't saved any articles yet.</p>
                <button 
                  onClick={() => setView('home')}
                  className="text-primary font-bold hover:underline"
                >
                  Browse the latest news
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                {Object.values(savedArticles).map((article: any) => (
                  <article key={article.id} className="space-y-4 group relative">
                    <div className="relative">
                      <img src={article.imageUrl} alt={article.title} className="w-full aspect-[16/9] object-cover" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => toggleSaveArticle(article)}
                        className="absolute top-2 right-2 material-symbols-outlined bg-white/80 p-1 text-[#D60000] fill-1 transition-all duration-300 active:scale-150 text-base"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        bookmark
                      </button>
                    </div>
                    <span className="text-secondary font-bold text-[10px] uppercase tracking-widest block">{article.category}</span>
                    <h3 className="text-xl font-serif font-bold group-hover:text-primary transition-colors leading-tight">{article.title}</h3>
                    <p className="text-sm text-on-surface-variant font-body line-clamp-3">{article.summary}</p>
                    <a 
                      href={article.articleUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-block text-xs font-bold text-primary hover:underline uppercase tracking-widest"
                    >
                      Read Full Story
                    </a>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            <div className="flex items-center gap-4 border-b border-outline/10 pb-6">
              <button 
                onClick={() => setView('home')}
                className="material-symbols-outlined text-secondary hover:text-primary transition-colors"
              >
                arrow_back
              </button>
              <h2 className="text-4xl font-headline font-bold">Market Index Tracker</h2>
            </div>

            <div className="max-w-6xl mx-auto space-y-12">
              {/* Selection Section */}
              <div className="bg-surface-container-lowest dark:bg-surface-container-lowest-dark p-8 border border-outline/10 shadow-sm">
                <h3 className="text-xl font-headline font-bold mb-6 text-center">Select Indices to Monitor</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {[
                    { label: 'S&P 500', symbol: 'SPY' },
                    { label: 'Russell 2000', symbol: 'IWM' },
                    { label: 'Nasdaq 100', symbol: 'QQQ' },
                    { label: 'Dow Jones', symbol: 'DIA' },
                    { label: 'Gold Price', symbol: 'GLD' },
                    { label: 'Silver Price', symbol: 'SLV' },
                    { label: 'Nikkei 225', symbol: 'NI225' },
                    { label: 'DAX', symbol: 'DAX' }
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        if (selectedIndices.includes(item.label)) {
                          setSelectedIndices(selectedIndices.filter(i => i !== item.label));
                        } else {
                          setSelectedIndices([...selectedIndices, item.label]);
                        }
                      }}
                      className={`px-6 py-2 text-xs font-bold uppercase tracking-widest border transition-all duration-200 ${
                        selectedIndices.includes(item.label)
                          ? 'bg-white dark:bg-zinc-800 border-primary text-primary shadow-md scale-105'
                          : 'bg-white dark:bg-zinc-800 border-outline/20 text-secondary dark:text-zinc-400 hover:border-primary hover:text-primary'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Monitor Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-outline/10 pb-2">
                  <h3 className="text-lg font-headline font-bold uppercase tracking-tight">Trading Monitor</h3>
                  <span className="text-[10px] font-mono text-on-surface-variant/60">REAL-TIME DATA FEED • TRADINGVIEW INTERFACE</span>
                </div>
                
                {selectedIndices.length === 0 ? (
                  <div className="py-20 text-center border-2 border-dashed border-outline/10 bg-surface-container-low dark:bg-surface-container-low-dark">
                    <span className="material-symbols-outlined text-4xl text-outline/20 mb-4">monitoring</span>
                    <p className="text-on-surface-variant/60 font-body">Select indices above to activate the monitor wall.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {selectedIndices.map(index => {
                      // Map labels to TradingView symbols
                      const symbolMap: Record<string, string> = {
                        'S&P 500': 'SPY',
                        'Russell 2000': 'IWM',
                        'Nasdaq 100': 'QQQ',
                        'Dow Jones': 'DJI',
                        'Gold Price': 'TVC:GOLD',
                        'Silver Price': 'TVC:SILVER',
                        'Nikkei 225': 'INDEX:NKY',
                        'DAX': 'XETR:DAX'
                      };
                      const symbol = symbolMap[index] || 'SPY';
                      
                      return (
                        <div key={index} className="bg-black border border-zinc-800 shadow-2xl overflow-hidden group">
                          <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800">
                            <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-widest">{index}</span>
                            <div className="flex gap-1">
                              <div className="w-2 h-2 rounded-full bg-red-500/20"></div>
                              <div className="w-2 h-2 rounded-full bg-yellow-500/20"></div>
                              <div className="w-2 h-2 rounded-full bg-green-500/20 group-hover:bg-green-500 transition-colors"></div>
                            </div>
                          </div>
                          <div className="h-[300px] w-full bg-black">
                            {/* TradingView Widget Placeholder - In a real app we'd use the script tag or an iframe */}
                            <iframe
                              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_76266&symbol=${symbol}&interval=D&hidesidetoolbar=1&hidetoptoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=en&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=${symbol}`}
                              style={{ width: '100%', height: '100%', border: 'none' }}
                              title={index}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#e8e8e8] dark:bg-zinc-950 mt-16 border-t-0">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-10 w-full max-w-[1440px] mx-auto gap-8">
          <div className="flex flex-col gap-4">
            <span className="text-2xl font-serif text-black dark:text-white italic">Chungjeong Street Journal</span>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-label">© 2024 Chungjeong Street Journal. All rights reserved. Editorial Precision Framework.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Contact Us', 'Help Center', 'Ad Choices'].map(link => (
              <a key={link} className="text-slate-600 dark:text-slate-400 text-xs font-label hover:text-[#D60000] transition-colors" href="#">{link}</a>
            ))}
          </div>
          <div className="flex gap-4">
            <span className="material-symbols-outlined text-slate-600 cursor-pointer hover:text-primary">rss_feed</span>
            <span className="material-symbols-outlined text-slate-600 cursor-pointer hover:text-primary">share</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-8 shadow-2xl relative">
            <button 
              onClick={() => { setShowAuthModal(false); resetAuthForm(); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-black dark:hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <h2 className="text-3xl font-headline font-bold mb-2">
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-sm text-on-surface-variant/60 mb-8 font-body">
              {authMode === 'login' ? 'Enter your credentials to access your workspace.' : 'Join our community of precision-focused readers.'}
            </p>

            {error && (
              <div className="bg-error-container text-on-error-container p-3 text-xs mb-6 border-l-4 border-error">
                {error}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant/60 mb-1">Display Name</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-surface-container-high border-none text-sm px-4 py-3 focus:ring-1 focus:ring-primary"
                    placeholder="Your Name"
                  />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant/60 mb-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-container-high border-none text-sm px-4 py-3 focus:ring-1 focus:ring-primary"
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant/60 mb-1">Password</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-container-high border-none text-sm px-4 py-3 focus:ring-1 focus:ring-primary"
                  placeholder="••••••••"
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white font-bold py-4 text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
              >
                {loading ? 'Processing...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-outline/10 text-center">
              <p className="text-xs text-on-surface-variant/60 font-body">
                {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
                <button 
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-primary font-bold hover:underline"
                >
                  {authMode === 'login' ? 'Join Now' : 'Sign In'}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm p-8 shadow-2xl text-center">
            <h2 className="text-2xl font-headline font-bold mb-4">Sign Out</h2>
            <p className="text-sm text-on-surface-variant/60 mb-8 font-body">Are you sure you want to sign out of your account?</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 border border-outline/20 py-3 text-xs font-bold uppercase tracking-widest hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => { handleLogout(); setShowLogoutModal(false); }}
                className="flex-1 bg-primary text-white py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary-container transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
