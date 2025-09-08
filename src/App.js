import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged,
    signInWithCustomToken
} from 'firebase/auth';
import { 
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    increment,
    arrayUnion,
    Timestamp,
    orderBy,
    limit,
    deleteDoc,
    setDoc,
    getDocs
} from 'firebase/firestore';

// --- Firebase & App Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyDASN9aqX9EPjyoDgQlO0AZU_UK57PmVJk",
    authDomain: "my-ai-mood-note.firebaseapp.com",
    projectId: "my-ai-mood-note",
    storageBucket: "my-ai-mood-note.firebasestorage.app",
    messagingSenderId: "941974695954",
    appId: "1:941974695954:web:6ecb1a67b878fb3b4728cb",
    measurementId: "G-DTVQFBKKV4"
};
const appId = 'my-ai-mood-note';

// --- Gemini API Configuration ---
const GEMINI_API_KEY = ""; // Provided by the environment
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

// --- API Helper ---
async function callGeminiAPI(prompt) {
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
    const result = await response.json();
    if (result.candidates && result.candidates.length > 0) {
        return result.candidates[0].content.parts[0].text.trim();
    }
    throw new Error("No content generated from API.");
}

// --- Main App Component ---
export default function App() {
    const [page, setPage] = useState('journal');
    const [user, setUser] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });

    useEffect(() => {
    try {
        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);
        setDb(firestoreDb);
        setAuth(firebaseAuth);

        const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                signInAnonymously(firebaseAuth).catch(error => {
                    console.error("Anonymous sign-in failed:", error);
                });
            }
        });
        return () => unsubscribe();
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
}, []);

    const showNotification = useCallback((message, type = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
    }, []);

    const renderPage = () => {
        if (!user || !db) {
            return <div className="flex justify-center items-center h-screen"><div>Loading...</div></div>;
        }
        switch (page) {
            case 'community':
                return <CommunityView db={db} user={user} showNotification={showNotification} />;
            case 'leaderboard':
                return <LeaderboardView db={db} />;
            case 'journal':
            default:
                return <MyJournalView db={db} user={user} showNotification={showNotification} />;
        }
    };

    return (
        <>
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap');
                body { font-family: 'Inter', sans-serif; }
                .toggle-checkbox:checked ~ .toggle-container { background-color: #34D399; }
                .toggle-checkbox:checked ~ .toggle-label { transform: translateX(100%); }
                .like-animation { animation: like-pop 0.4s ease-in-out; }
                @keyframes like-pop {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.4); }
                    100% { transform: scale(1); }
                }
                `}
            </style>
            <div className="bg-gray-100 min-h-screen font-sans text-gray-800">
                <div className="container mx-auto max-w-2xl p-4">
                    <Nav currentPage={page} setPage={setPage} />
                    <main>{renderPage()}</main>
                    <footer className="text-center text-gray-500 text-sm mt-8">
                        <p>Published entries are shared anonymously.</p>
                    </footer>
                </div>
                <Notification {...notification} />
            </div>
        </>
    );
}

// --- UI Components ---

const Nav = ({ currentPage, setPage }) => {
    const navItems = [
        { id: 'journal', label: 'My Journal' },
        { id: 'community', label: 'Community' },
        { id: 'leaderboard', label: 'Leaderboard' },
    ];
    return (
        <nav className="bg-white rounded-full shadow-md mb-8 p-2 flex justify-around items-center">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setPage(item.id)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-300 ${
                        currentPage === item.id ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    {item.label}
                </button>
            ))}
        </nav>
    );
};

const Spinner = () => <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>;

const Notification = ({ show, message, type }) => (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-sm shadow-lg transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'} ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
        {message}
    </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm m-4">
                <h3 className="text-lg font-bold mb-4">{title}</h3>
                <div>{children}</div>
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
        </div>
    );
};

// --- Page Components ---

const MyJournalView = ({ db, user, showNotification }) => {
    return (
        <div>
            <JournalEntryForm db={db} user={user} showNotification={showNotification} />
            <JournalHistory db={db} user={user} showNotification={showNotification} />
        </div>
    );
};

const JournalEntryForm = ({ db, user, showNotification }) => {
    const [selectedMood, setSelectedMood] = useState(null);
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAiWriting, setIsAiWriting] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [pendingEntry, setPendingEntry] = useState(null);
    const [existingPublicNote, setExistingPublicNote] = useState(null);

    const moodOptions = [
        { icon: '☀️', text: 'Sunny' }, { icon: '🌤️', text: 'Clear' },
        { icon: '☁️', text: 'Cloudy' }, { icon: '🌧️', text: 'Rainy' }, { icon: '⛈️', text: 'Stormy' }
    ];

    const handleAiWrite = async () => {
        if (!selectedMood) {
            showNotification('Please select a mood first!', 'error');
            return;
        }
        setIsAiWriting(true);
        try {
            const prompt = `My mood today is ${selectedMood.text} (${selectedMood.icon}). Please write a short, creative journal entry starter for me in English, under 25 words.`;
            const generatedText = await callGeminiAPI(prompt);
            setMessage(generatedText);
        } catch (error) {
            showNotification('AI service is unavailable right now.', 'error');
        } finally {
            setIsAiWriting(false);
        }
    };

    const handleSave = () => {
        if (!selectedMood) {
            showNotification('Please select a mood!', 'error');
            return;
        }
        if (message.trim() === '') {
            showNotification('Please write a message!', 'error');
            return;
        }
        const entry = {
            userId: user.uid,
            mood: selectedMood.icon,
            message: message.trim(),
            date: new Date().toISOString().split('T')[0],
            timestamp: Timestamp.now(),
        };
        setPendingEntry(entry);
        setIsShareModalOpen(true);
    };
    
    const resetForm = () => {
        setSelectedMood(null);
        setMessage('');
        setIsSubmitting(false);
        setPendingEntry(null);
        setExistingPublicNote(null);
        setIsShareModalOpen(false);
        setIsLimitModalOpen(false);
    };

    const initiatePublish = async () => {
        setIsSubmitting(true);
        const todayStr = new Date().toISOString().split('T')[0];
        const q = query(
            collection(db, `/artifacts/${appId}/users/${user.uid}/notes`),
            where("date", "==", todayStr),
            where("isPublic", "==", true),
            limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            setExistingPublicNote({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });
            setIsShareModalOpen(false);
            setIsLimitModalOpen(true);
        } else {
            await handleConfirmSave(true);
        }
        setIsSubmitting(false);
    };

    const handleConfirmSave = async (isPublic) => {
        if (!pendingEntry) return;
        setIsSubmitting(true);
        
        const privateNoteRef = doc(collection(db, `/artifacts/${appId}/users/${user.uid}/notes`));
        const finalEntry = { ...pendingEntry, isPublic, publicNoteId: null };

        try {
            if (isPublic) {
                const publicNoteRef = doc(collection(db, `/artifacts/${appId}/public/data/public_notes`));
                const publicEntry = { ...pendingEntry, likes: 0, likedBy: [] };
                await setDoc(publicNoteRef, publicEntry);
                finalEntry.publicNoteId = publicNoteRef.id;
            }
            
            await setDoc(privateNoteRef, finalEntry);
            showNotification(isPublic ? 'Your entry has been published!' : 'Saved privately!');
            resetForm();
        } catch (error) {
            showNotification('Failed to save. Please try again.', 'error');
            setIsSubmitting(false);
        }
    };

    const handleSwapPublic = async () => {
        if (!pendingEntry || !existingPublicNote) return;
        setIsSubmitting(true);
        try {
            // Make old note private
            const oldPrivateRef = doc(db, `/artifacts/${appId}/users/${user.uid}/notes`, existingPublicNote.id);
            await updateDoc(oldPrivateRef, { isPublic: false, publicNoteId: null });
            if (existingPublicNote.publicNoteId) {
                const oldPublicRef = doc(db, `/artifacts/${appId}/public/data/public_notes`, existingPublicNote.publicNoteId);
                await deleteDoc(oldPublicRef);
            }
            // Save new note as public
            await handleConfirmSave(true);
        } catch (error) {
            showNotification('Failed to swap entries. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
            resetForm();
        }
    };

    return (
        <>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-center text-xl font-bold mb-4">How are you feeling today?</h2>
                <div className="flex justify-around my-6">
                    {moodOptions.map(mood => (
                        <span key={mood.icon} title={mood.text}
                            className={`text-4xl cursor-pointer transition-all duration-200 ${selectedMood?.icon === mood.icon ? 'transform scale-125' : 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0'}`}
                            onClick={() => setSelectedMood(mood)}
                        >{mood.icon}</span>
                    ))}
                </div>
                <div className="flex justify-between items-center mb-2">
                    <label className="font-semibold text-gray-600">Your thoughts:</label>
                    <button onClick={handleAiWrite} disabled={isAiWriting} className="flex items-center gap-2 text-sm bg-purple-600 text-white px-3 py-1 rounded-full hover:bg-purple-700 transition-colors disabled:bg-purple-300">
                        {isAiWriting ? <Spinner/> : '✨'}
                        AI Write for Me
                    </button>
                </div>
                <textarea
                    className="w-full p-3 border rounded-md min-h-[120px] focus:ring-2 focus:ring-blue-400"
                    placeholder="Jot down your thoughts here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <div className="mt-4">
                    <button onClick={handleSave} className="w-full bg-blue-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                        Save Entry
                    </button>
                </div>
            </div>
            <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Share your entry?">
                <p className="text-gray-600 mb-4 text-sm">Would you like to publish this entry anonymously to the community page?</p>
                <div className="grid grid-cols-2 gap-3">
                     <button onClick={() => handleConfirmSave(false)} disabled={isSubmitting} className="w-full bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors">
                        Keep Private
                    </button>
                    <button onClick={initiatePublish} disabled={isSubmitting} className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex justify-center items-center">
                        {isSubmitting ? <Spinner/> : 'Publish Publicly'}
                    </button>
                </div>
            </Modal>
            <Modal isOpen={isLimitModalOpen} onClose={() => setIsLimitModalOpen(false)} title="Daily Public Limit Reached">
                <p className="text-gray-600 mb-4 text-sm">You already have a public note today. What would you like to do?</p>
                <div className="space-y-3">
                    <button onClick={handleSwapPublic} disabled={isSubmitting} className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex justify-center items-center">
                        {isSubmitting ? <Spinner/> : 'Make This Public (replace old one)'}
                    </button>
                    <button onClick={() => handleConfirmSave(false)} disabled={isSubmitting} className="w-full bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors">
                        Keep This One Private
                    </button>
                </div>
            </Modal>
        </>
    );
};

const JournalHistory = ({ db, user, showNotification }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [noteToToggle, setNoteToToggle] = useState(null);
    const [existingPublicNote, setExistingPublicNote] = useState(null);

    useEffect(() => {
        const q = query(collection(db, `/artifacts/${appId}/users/${user.uid}/notes`), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [db, user.uid]);

    const handleTogglePublic = async (note) => {
        const newPublicStatus = !note.isPublic;
        
        if (newPublicStatus) {
            // Check if another note is public on the same day
            const q = query(
                collection(db, `/artifacts/${appId}/users/${user.uid}/notes`),
                where("date", "==", note.date),
                where("isPublic", "==", true),
                limit(1)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                setNoteToToggle(note);
                setExistingPublicNote({id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data()});
                setIsLimitModalOpen(true);
                return;
            }
        }
        // Proceed if making private or if no other public note exists for the day
        await performToggle(note, newPublicStatus);
    };

    const performToggle = async (note, newPublicStatus) => {
        const privateNoteRef = doc(db, `/artifacts/${appId}/users/${user.uid}/notes`, note.id);
        try {
            if (newPublicStatus) {
                const publicNoteRef = doc(collection(db, `/artifacts/${appId}/public/data/public_notes`));
                const publicEntry = {
                    userId: note.userId, mood: note.mood, message: note.message,
                    date: note.date, timestamp: note.timestamp, likes: 0, likedBy: [],
                };
                await setDoc(publicNoteRef, publicEntry);
                await updateDoc(privateNoteRef, { isPublic: true, publicNoteId: publicNoteRef.id });
                showNotification("Entry is now public!");
            } else {
                if (note.publicNoteId) {
                    const publicNoteRef = doc(db, `/artifacts/${appId}/public/data/public_notes`, note.publicNoteId);
                    await deleteDoc(publicNoteRef);
                }
                await updateDoc(privateNoteRef, { isPublic: false, publicNoteId: null });
                showNotification("Entry is now private.");
            }
        } catch (error) {
            showNotification("Failed to update status.", "error");
        }
    };

    const handleSwapPublic = async () => {
        if (!noteToToggle || !existingPublicNote) return;
        
        // Make old one private
        const oldPrivateRef = doc(db, `/artifacts/${appId}/users/${user.uid}/notes`, existingPublicNote.id);
        await updateDoc(oldPrivateRef, { isPublic: false, publicNoteId: null });
        if (existingPublicNote.publicNoteId) {
            const oldPublicRef = doc(db, `/artifacts/${appId}/public/data/public_notes`, existingPublicNote.publicNoteId);
            await deleteDoc(oldPublicRef);
        }

        // Make new one public
        await performToggle(noteToToggle, true);
        
        setIsLimitModalOpen(false);
        setNoteToToggle(null);
        setExistingPublicNote(null);
    };

    return (
        <>
            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4 text-center">My History</h2>
                {loading && <p className="text-center">Loading history...</p>}
                {!loading && history.length === 0 && <p className="text-center bg-white p-6 rounded-lg shadow-md text-gray-500">Your journal is empty. Write an entry to get started!</p>}
                <div className="space-y-4">
                    {history.map(note => (
                        <div key={note.id} className="bg-white p-4 rounded-lg shadow-md">
                            <div className="flex items-start gap-4">
                                <span className="text-3xl mt-1">{note.mood}</span>
                                <div className="flex-grow">
                                    <p className="text-gray-700">{note.message}</p>
                                    <p className="text-xs text-gray-400 mt-2">
                                        {new Date(note.timestamp.toDate()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold ${note.isPublic ? 'text-green-500' : 'text-gray-500'}`}>
                                            {note.isPublic ? 'Public' : 'Private'}
                                        </span>
                                        <label htmlFor={`toggle-${note.id}`} className="relative w-10 h-5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                id={`toggle-${note.id}`}
                                                className="toggle-checkbox absolute w-full h-full opacity-0"
                                                checked={note.isPublic}
                                                onChange={() => handleTogglePublic(note)}
                                            />
                                            <div className="toggle-container bg-gray-300 rounded-full w-full h-full transition-colors"></div>
                                            <div className="toggle-label bg-white w-4 h-4 rounded-full shadow-md absolute top-0.5 left-0.5 transition-transform"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <Modal isOpen={isLimitModalOpen} onClose={() => setIsLimitModalOpen(false)} title="Daily Public Limit Reached">
                <p className="text-gray-600 mb-4 text-sm">You can only have one public note per day. Would you like to make this one public instead?</p>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setIsLimitModalOpen(false)} className="w-full bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSwapPublic} className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                        Yes, Swap
                    </button>
                </div>
            </Modal>
        </>
    );
};

const CommunityView = ({ db, user, showNotification }) => {
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfToday = Timestamp.fromDate(today);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const startOfTomorrow = Timestamp.fromDate(tomorrow);

        const notesQuery = query(
            collection(db, `/artifacts/${appId}/public/data/public_notes`), 
            where("timestamp", ">=", startOfToday),
            where("timestamp", "<", startOfTomorrow),
            orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
            setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, () => setLoading(false));
        return () => unsubscribe();
    }, [db]);
    
    const handleLike = (noteId, likedBy) => {
        if (likedBy.includes(user.uid)) {
            showNotification("You can only like a post once!", "error");
            return;
        }

        const heartElement = document.querySelector(`[data-note-id="${noteId}"] .like-icon`);
        if(heartElement){
            heartElement.classList.add('like-animation');
            heartElement.addEventListener('animationend', () => {
                heartElement.classList.remove('like-animation');
            }, {once: true});
        }
        
        setNotes(currentNotes =>
            currentNotes.map(note =>
                note.id === noteId
                    ? { ...note, likes: note.likes + 1, likedBy: [...note.likedBy, user.uid] }
                    : note
            )
        );

        const noteRef = doc(db, `/artifacts/${appId}/public/data/public_notes`, noteId);
        updateDoc(noteRef, { likes: increment(1), likedBy: arrayUnion(user.uid) });
    };

    if (loading) return <div className="text-center p-10">Loading today's community entries...</div>;

    return (
        <div>
            <h2 className="text-center text-2xl font-bold mb-6">Today's Community Entries</h2>
            {notes.length === 0 ? (
                <p className="text-center text-gray-500 bg-white p-6 rounded-lg shadow-md">Nobody has shared today. Be the first!</p>
            ) : (
                <div className="space-y-4">
                    {notes.map(note => (
                        <div key={note.id} data-note-id={note.id} className="bg-white p-4 rounded-lg shadow-md flex items-start gap-4">
                            <span className="text-3xl mt-1">{note.mood}</span>
                            <div className="flex-grow">
                                <p className="text-gray-700">{note.message}</p>
                                <div className="text-xs text-gray-400 mt-2">From an anonymous friend</div>
                            </div>
                            <button onClick={() => handleLike(note.id, note.likedBy)} disabled={note.likedBy.includes(user.uid)} className="flex items-center gap-2 text-gray-500 disabled:text-red-500 transition-colors py-1 px-2 rounded-full hover:bg-red-100">
                                <span className={`like-icon ${note.likedBy.includes(user.uid) ? 'text-red-500' : ''}`}>❤️</span>
                                <span className="font-semibold">{note.likes}</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const LeaderboardView = ({ db }) => {
    const [weeklyNotes, setWeeklyNotes] = useState([]);
    const [monthlyNotes, setMonthlyNotes] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTopNotes = useCallback((period, setter) => {
        const startDate = new Date();
        if (period === 'weekly') startDate.setDate(startDate.getDate() - 7);
        else startDate.setMonth(startDate.getMonth() - 1);
        
        // Corrected Query: Only filter by one range field on the server.
        const q = query(
            collection(db, `/artifacts/${appId}/public/data/public_notes`), 
            where("timestamp", ">=", Timestamp.fromDate(startDate))
        );
        
        return onSnapshot(q, (snapshot) => {
            const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filter and sort on the client side
            const filteredAndSortedNotes = notesData
                .filter(note => note.likes > 0)
                .sort((a, b) => b.likes - a.likes);

            setter(filteredAndSortedNotes);
        });
    }, [db]);

    useEffect(() => {
        setLoading(true);
        const unsubWeekly = fetchTopNotes('weekly', setWeeklyNotes);
        const unsubMonthly = fetchTopNotes('monthly', setMonthlyNotes);
        setLoading(false);
        return () => { unsubWeekly(); unsubMonthly(); };
    }, [fetchTopNotes]);

    const LeaderboardList = ({ title, notes }) => {
        const [visibleCount, setVisibleCount] = useState(10);
        const visibleNotes = notes.slice(0, visibleCount);

        return (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <h3 className="text-xl font-bold mb-4 text-center">{title}</h3>
                {notes.length === 0 ? (
                     <p className="text-center text-gray-500">No popular notes yet.</p>
                ) : (
                    <>
                        <ul className="space-y-3">
                            {visibleNotes.map((note, index) => (
                                <li key={note.id} className="flex items-center gap-4 border-b pb-3 last:border-b-0">
                                    <span className="text-lg font-bold text-gray-400 w-5">{index + 1}</span>
                                    <span className="text-2xl">{note.mood}</span>
                                    <p className="text-gray-600 truncate flex-grow">"{note.message}"</p>
                                    <span className="text-red-500 font-bold flex items-center gap-1">❤️<span>{note.likes}</span></span>
                                </li>
                            ))}
                        </ul>
                        {notes.length > visibleCount && (
                            <button 
                                onClick={() => setVisibleCount(prev => prev + 10)}
                                className="w-full mt-4 bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                Show More
                            </button>
                        )}
                    </>
                )}
            </div>
        );
    };
    
    if (loading) return <div className="text-center p-10">Loading leaderboards...</div>;

    return (
        <div>
            <h2 className="text-center text-2xl font-bold mb-6">🏆 Popularity Leaderboards 🏆</h2>
            <LeaderboardList title="Top This Week" notes={weeklyNotes} />
            <LeaderboardList title="Top This Month" notes={monthlyNotes} />
        </div>
    );
};
