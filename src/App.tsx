/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { db, auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, Timestamp, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { 
  MessageSquare, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  ChevronRight, 
  ChevronDown,
  Quote,
  Send, 
  User, 
  Bot,
  X,
  CheckCircle2,
  Menu,
  LogOut,
  History,
  ExternalLink,
  LayoutDashboard,
  TrendingUp,
  Users,
  Check,
  Ban
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { CLINIC_POLICIES } from './constants';

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface Message {
  role: 'user' | 'bot';
  text: string;
}

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border-b border-slate-200 py-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-left hover:text-blue-600 transition-colors py-2"
      >
        <span className="font-bold text-slate-800">{question}</span>
        <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="text-slate-600 text-sm leading-relaxed pb-4 pt-2">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState(false);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [userAppointments, setUserAppointments] = useState<any[]>([]);
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isCommandCenterLoading, setIsCommandCenterLoading] = useState(false);
  const [adminFilter, setAdminFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [adminSearch, setAdminSearch] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: "Hello! I'm Doc Gab, your P&B Dental Clinic assistant. How can I help you today with our policies or services?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingData, setBookingData] = useState({
    name: '',
    email: '',
    phone: '',
    service: 'General Checkup',
    date: '',
    time: '',
    slot: ''
  });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [contactStatus, setContactStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [contactData, setContactData] = useState({ name: '', email: '', subject: '', message: '' });

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const model = "gemini-3-flash-preview";
      const prompt = `
        You are Doc Gab, the professional and friendly AI assistant for P&B Dental Clinic.
        Your primary role is to answer questions about the clinic's policies, services, and operating hours based ONLY on the information provided below.
        
        CLINIC INFORMATION:
        ${CLINIC_POLICIES}
        
        RULES:
        1. Only answer based on the provided clinic information.
        2. If a user asks something outside of these policies (e.g., medical advice, personal questions, or other businesses), politely state that you can only assist with clinic-related inquiries and suggest they consult our dentists in person.
        3. Be concise, professional, and helpful.
        4. If they want to book an appointment, tell them they can use the "Book Appointment" button on the website.
        
        USER QUESTION: ${userMessage}
      `;

      const response = await genAI.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const botResponse = response.text || "I'm sorry, I couldn't process that. Please try again or contact us directly.";
      setMessages(prev => [...prev, { role: 'bot', text: botResponse }]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'bot', text: "I'm having a little trouble connecting. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (bookingData.date) {
      // Mocking real-time slot generation based on date
      const slots = [
        '09:00 AM', '10:00 AM', '11:00 AM', 
        '01:00 PM', '02:00 PM', '03:00 PM', 
        '04:00 PM', '05:00 PM'
      ];
      // Randomly filter some slots to simulate "availability"
      const seed = bookingData.date.split('-').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const filteredSlots = slots.filter((_, index) => (seed + index) % 3 !== 0);
      setAvailableSlots(filteredSlots);
    }
  }, [bookingData.date]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAdmin(currentUser?.email === "romelmontiagodo68@gmail.com");
      if (currentUser) {
        // Pre-fill booking data if logged in
        setBookingData(prev => ({
          ...prev,
          name: currentUser.displayName || '',
          email: currentUser.email || ''
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsPortalOpen(false);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const fetchUserAppointments = async () => {
    if (!user) return;
    setIsPortalLoading(true);
    try {
      const q = query(
        collection(db, 'appointments'),
        where('email', '==', user.email),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const appointments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserAppointments(appointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setIsPortalLoading(false);
    }
  };

  useEffect(() => {
    if (isPortalOpen && user) {
      fetchUserAppointments();
    }
  }, [isPortalOpen, user]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    if (isCommandCenterOpen && isAdmin) {
      setIsCommandCenterLoading(true);
      const q = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const appointments = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllAppointments(appointments);
        setIsCommandCenterLoading(false);
      }, (error) => {
        console.error("Command Center Error:", error);
        setIsCommandCenterLoading(false);
      });
    }

    return () => unsubscribe?.();
  }, [isCommandCenterOpen, isAdmin]);

  const handleUpdateStatus = async (appointmentId: string, newStatus: 'confirmed' | 'cancelled') => {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await updateDoc(appointmentRef, { status: newStatus });
      console.log(`Appointment ${appointmentId} updated to ${newStatus}`);

      // If confirmed, send email notification
      if (newStatus === 'confirmed') {
        const apt = allAppointments.find(a => a.id === appointmentId);
        if (apt) {
          try {
            await fetch('/api/send-confirmation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: apt.email,
                name: apt.name,
                service: apt.service,
                date: apt.date,
                slot: apt.slot
              })
            });
            console.log("Confirmation email sent to patient");
          } catch (emailError) {
            console.error("Failed to trigger email notification:", emailError);
          }
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const calculateSales = () => {
    const servicePrices: { [key: string]: number } = {
      'General Checkup': 500,
      'Teeth Cleaning': 1200,
      'Orthodontic Consultation': 1500,
      'Dental Implant Inquiry': 2000,
      'Teeth Whitening': 3500,
      'Oral Surgery': 5000
    };

    return allAppointments
      .filter(apt => apt.status === 'confirmed')
      .reduce((total, apt) => total + (servicePrices[apt.service] || 0), 0);
  };

  const filteredAdminAppointments = allAppointments.filter(apt => {
    const matchesFilter = adminFilter === 'all' || apt.status === adminFilter;
    const matchesSearch = apt.name.toLowerCase().includes(adminSearch.toLowerCase()) || 
                         apt.email.toLowerCase().includes(adminSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingStep(4); // Success state
    
    try {
      // Save to Firestore
      await addDoc(collection(db, 'appointments'), {
        ...bookingData,
        uid: user?.uid || null,
        status: 'pending',
        reminderSent: false,
        createdAt: serverTimestamp()
      });
      console.log("Appointment saved to Firestore");
    } catch (error) {
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified,
        },
        operationType: 'create',
        path: 'appointments'
      };
      console.error('Firestore Error: ', JSON.stringify(errInfo));
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactStatus('sending');
    // Simulate API call
    setTimeout(() => {
      setContactStatus('success');
      setContactData({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setContactStatus('idle'), 5000);
    }, 1500);
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCommandCenterLoading(true);
    try {
      await addDoc(collection(db, 'appointments'), {
        ...bookingData,
        uid: null, // Manually added by admin
        status: 'confirmed', // Default to confirmed when added by admin
        reminderSent: false,
        createdAt: serverTimestamp()
      });
      setIsAddPatientOpen(false);
      setBookingData({
        name: '',
        email: '',
        phone: '',
        service: 'General Checkup',
        date: '',
        time: '',
        slot: ''
      });
    } catch (error) {
      console.error("Error adding patient:", error);
    } finally {
      setIsCommandCenterLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                P&B
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-800">Dental Clinic</span>
            </div>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#home" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Home</a>
              <a href="#services" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Services</a>
              <a href="#faq" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">FAQ</a>
              <a href="#contact" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Contact</a>
              
              {user ? (
                <div className="flex items-center gap-4">
                  {isAdmin && (
                    <button 
                      onClick={() => setIsCommandCenterOpen(true)}
                      className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-all"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Command Center
                    </button>
                  )}
                  <button 
                    onClick={() => setIsPortalOpen(true)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Portal
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Patient Login
                </button>
              )}

              <button 
                onClick={() => { setIsBookingOpen(true); setBookingStep(1); }}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                Book Appointment
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button className="md:hidden p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-50 bg-white p-6 md:hidden"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">P&B</div>
                <span className="font-bold">Dental Clinic</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)}><X /></button>
            </div>
            <div className="flex flex-col gap-6 text-lg font-medium">
              <a href="#home" onClick={() => setIsMobileMenuOpen(false)}>Home</a>
              <a href="#services" onClick={() => setIsMobileMenuOpen(false)}>Services</a>
              <a href="#faq" onClick={() => setIsMobileMenuOpen(false)}>FAQ</a>
              <a href="#contact" onClick={() => setIsMobileMenuOpen(false)}>Contact</a>
              
              {user ? (
                <>
                  {isAdmin && (
                    <button 
                      onClick={() => { setIsCommandCenterOpen(true); setIsMobileMenuOpen(false); }}
                      className="flex items-center gap-2 text-left font-bold text-blue-600"
                    >
                      <LayoutDashboard className="w-5 h-5" />
                      Command Center
                    </button>
                  )}
                  <button 
                    onClick={() => { setIsPortalOpen(true); setIsMobileMenuOpen(false); }}
                    className="flex items-center gap-2 text-left"
                  >
                    <User className="w-5 h-5 text-blue-600" />
                    Patient Portal
                  </button>
                  <button 
                    onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                    className="flex items-center gap-2 text-left text-red-600"
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => { handleLogin(); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-2 text-left text-blue-600"
                >
                  <User className="w-5 h-5" />
                  Patient Login
                </button>
              )}

              <button 
                onClick={() => { setIsBookingOpen(true); setBookingStep(1); setIsMobileMenuOpen(false); }}
                className="bg-blue-600 text-white py-4 rounded-xl font-bold"
              >
                Book Appointment
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section id="home" className="relative pt-20 pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block px-4 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold tracking-wider uppercase rounded-full mb-6">
                Excellence in Oral Care
              </span>
              <h1 className="text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.1] mb-6">
                Your Smile, Our <span className="text-blue-600">Priority</span>.
              </h1>
              <p className="text-lg text-slate-600 mb-10 max-w-lg leading-relaxed">
                Experience professional dental care with a personal touch. From routine checkups to advanced orthodontics, we're here to keep your smile healthy and bright.
              </p>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => { setIsBookingOpen(true); setBookingStep(1); }}
                  className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 group"
                >
                  Book Your Visit <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => setIsChatOpen(true)}
                  className="bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-full font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  Ask Doc Gab <MessageSquare className="w-5 h-5 text-blue-600" />
                </button>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="aspect-square rounded-3xl overflow-hidden shadow-2xl relative">
                <img 
                  src="https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&q=80&w=1000" 
                  alt="Modern Dental Clinic" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent"></div>
              </div>
              {/* Floating Card */}
              <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-2xl shadow-xl border border-slate-100 max-w-xs hidden sm:block">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Safe & Sterile</div>
                    <div className="text-xs text-slate-500">ISO Certified Standards</div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 italic">"The best dental experience I've ever had. Highly professional!"</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.span 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-blue-600 font-bold tracking-widest uppercase text-sm"
            >
              Our Expertise
            </motion.span>
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl font-bold text-slate-900 mt-2"
            >
              Comprehensive Dental Care
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-600 mt-4 max-w-2xl mx-auto"
            >
              We provide a wide range of dental services using the latest technology to ensure the best possible outcomes for our patients.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "General Checkup",
                icon: <User className="w-6 h-6" />,
                procedure: "A comprehensive examination of teeth, gums, and mouth, including X-rays if necessary.",
                benefits: "Early detection of cavities, gum disease, and other oral health issues.",
                recovery: "No recovery time needed. Immediate return to daily activities.",
                color: "blue"
              },
              {
                title: "Teeth Cleaning",
                icon: <Clock className="w-6 h-6" />,
                procedure: "Professional removal of plaque and tartar, followed by polishing and fluoride treatment.",
                benefits: "Prevents gum disease, removes surface stains, and ensures fresh breath.",
                recovery: "Minor tooth sensitivity for 24 hours; otherwise, no downtime.",
                color: "green"
              },
              {
                title: "Orthodontics",
                icon: <ChevronRight className="w-6 h-6" />,
                procedure: "Assessment and fitting for traditional braces or clear aligners (Invisalign).",
                benefits: "Corrects bite issues, improves speech, and creates a perfectly aligned smile.",
                recovery: "Adjustment period of 3-7 days after each tightening or new aligner set.",
                color: "purple"
              },
              {
                title: "Dental Implants",
                icon: <MapPin className="w-6 h-6" />,
                procedure: "Surgical placement of a titanium post into the jawbone, followed by a custom crown.",
                benefits: "Permanent solution for missing teeth that looks and functions like a natural tooth.",
                recovery: "Initial healing in 7-10 days; full integration takes 3-6 months.",
                color: "indigo"
              },
              {
                title: "Teeth Whitening",
                icon: <Send className="w-6 h-6" />,
                procedure: "Application of professional-grade whitening gel activated by specialized light technology.",
                benefits: "Noticeably brighter smile in just one session, removing deep-set stains.",
                recovery: "Temporary sensitivity to hot/cold for 24-48 hours.",
                color: "yellow"
              },
              {
                title: "Oral Surgery",
                icon: <Bot className="w-6 h-6" />,
                procedure: "Procedures such as wisdom tooth extraction or bone grafting performed under local anesthesia.",
                benefits: "Relieves pain from impacted teeth and prepares the mouth for further restorative work.",
                recovery: "3-5 days for initial swelling to subside; soft food diet recommended for 1 week.",
                color: "red"
              }
            ].map((service, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {service.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">{service.title}</h3>
                
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1">Procedure</p>
                    <p className="text-slate-600 leading-relaxed">{service.procedure}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1">Key Benefits</p>
                    <p className="text-slate-600 leading-relaxed">{service.benefits}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-50">
                    <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1">Recovery Time</p>
                    <p className="text-blue-600 font-medium">{service.recovery}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">What Our Patients Say</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Real stories from real patients who have experienced the P&B Dental Clinic difference.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { 
                name: 'Maria Santos', 
                role: 'Orthodontic Patient', 
                text: 'The staff at P&B Dental Clinic are incredibly professional and friendly. My orthodontic treatment has been life-changing!',
                img: 'https://picsum.photos/seed/maria/200/200'
              },
              { 
                name: 'James Wilson', 
                role: 'General Dentistry', 
                text: "Doc Gab's AI assistant was so helpful in answering my questions about insurance before I even arrived. Great experience!",
                img: 'https://picsum.photos/seed/james/200/200'
              },
              { 
                name: 'Sarah Lee', 
                role: 'Cosmetic Dentistry', 
                text: 'Best dental clinic in the city. Very clean, modern equipment, and they really care about patient comfort.',
                img: 'https://picsum.photos/seed/sarah/200/200'
              },
              { 
                name: 'Robert Chen', 
                role: 'Pediatric Dentistry', 
                text: "I've always been nervous about dentists, but the team here made me feel at ease. Highly recommend for anyone with dental anxiety.",
                img: 'https://picsum.photos/seed/robert/200/200'
              },
            ].map((testimonial, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-slate-50 p-8 rounded-3xl border border-slate-100 relative group hover:bg-white hover:shadow-xl transition-all"
              >
                <Quote className="w-10 h-10 text-blue-100 absolute top-6 right-6 group-hover:text-blue-200 transition-colors" />
                <div className="flex items-center gap-4 mb-6">
                  <img 
                    src={testimonial.img} 
                    alt={testimonial.name} 
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{testimonial.name}</div>
                    <div className="text-xs text-blue-600 font-medium">{testimonial.role}</div>
                  </div>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed italic">"{testimonial.text}"</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-slate-600">Find answers to common questions about our clinic and services.</p>
          </div>
          
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <FAQItem 
              question="What are your clinic hours?" 
              answer="We are open Monday to Saturday from 9:00 AM to 6:00 PM. We are closed on Sundays, except for special emergency appointments." 
            />
            <FAQItem 
              question="Do I need to book an appointment?" 
              answer="Appointments are highly recommended to ensure you are seen promptly. We do accept walk-ins, but they are subject to availability." 
            />
            <FAQItem 
              question="What is your cancellation policy?" 
              answer="Please notify us at least 24 hours in advance if you need to reschedule or cancel. Patients arriving more than 15 minutes late may need to be rescheduled." 
            />
            <FAQItem 
              question="Which HMOs do you partner with?" 
              answer="We partner with Maxicare, Intellicare, Medicard, and PhilCare." 
            />
            <FAQItem 
              question="What payment methods do you accept?" 
              answer="We accept Cash, GCash, and major Credit Cards. We also offer installment plans for Orthodontic treatments." 
            />
            <FAQItem 
              question="What services do you offer?" 
              answer="We offer General Dentistry (cleaning, fillings, extractions), Orthodontics (braces, aligners), Dental Implants, Cosmetic Dentistry (whitening, veneers), Pediatric Dentistry, and Oral Surgery." 
            />
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-3xl font-bold mb-6">Get in Touch</h2>
              <p className="text-slate-600 mb-10 leading-relaxed">
                Have a question or need to discuss your dental health? Send us a message and our team will get back to you as soon as possible. You can also reach us directly at <span className="text-blue-600 font-bold">hello@pbdental.com</span>.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Our Location</div>
                    <div className="text-slate-500 text-sm">123 Smile Avenue, Dental District, Metro City</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Phone Number</div>
                    <div className="text-slate-500 text-sm">(555) 123-4567</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Email Address</div>
                    <div className="text-slate-500 text-sm">hello@pbdental.com</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-8 sm:p-10 rounded-3xl border border-slate-100 shadow-sm">
              {contactStatus === 'success' ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Message Sent!</h3>
                  <p className="text-slate-600">Thank you for reaching out. We'll get back to you at hello@pbdental.com shortly.</p>
                </motion.div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Your Name</label>
                      <input 
                        required
                        type="text" 
                        value={contactData.name}
                        onChange={(e) => setContactData({...contactData, name: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email Address</label>
                      <input 
                        required
                        type="email" 
                        value={contactData.email}
                        onChange={(e) => setContactData({...contactData, email: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Subject</label>
                    <input 
                      required
                      type="text" 
                      value={contactData.subject}
                      onChange={(e) => setContactData({...contactData, subject: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                      placeholder="How can we help?"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Message</label>
                    <textarea 
                      required
                      rows={4}
                      value={contactData.message}
                      onChange={(e) => setContactData({...contactData, message: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm resize-none"
                      placeholder="Tell us more about your inquiry..."
                    ></textarea>
                  </div>
                  <button 
                    type="submit"
                    disabled={contactStatus === 'sending'}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {contactStatus === 'sending' ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message <Send className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer / Contact */}
      <footer id="about" className="bg-slate-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">P&B</div>
                <span className="text-2xl font-bold tracking-tight">Dental Clinic</span>
              </div>
              <p className="text-slate-400 mb-8 max-w-md">
                Providing quality dental care for families since 2015. Our mission is to make every visit comfortable and every smile beautiful.
              </p>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer">
                  <Mail className="w-5 h-5" />
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-bold mb-6">Quick Links</h4>
              <ul className="space-y-4 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Home</a></li>
                <li><a href="#services" className="hover:text-white transition-colors">Services</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-6">Clinic Hours</h4>
              <ul className="space-y-4 text-slate-400">
                <li className="flex justify-between"><span>Mon - Sat</span> <span>9:00 - 18:00</span></li>
                <li className="flex justify-between"><span>Sunday</span> <span>Closed</span></li>
                <li className="pt-4 text-sm italic text-blue-400">Emergency cases by appointment only.</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-16 pt-8 text-center text-slate-500 text-sm">
            &copy; 2026 P&B Dental Clinic. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Admin Command Center Modal */}
      <AnimatePresence>
        {isCommandCenterOpen && isAdmin && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCommandCenterOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative bg-white w-full max-w-6xl h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <LayoutDashboard className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight">Command Center</h3>
                    <p className="text-blue-400 text-sm font-medium">Clinic Management Dashboard</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCommandCenterOpen(false)}
                  className="p-3 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-7 h-7" />
                </button>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 bg-slate-50 border-b border-slate-100">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Patients</div>
                    <div className="text-2xl font-bold text-slate-900">{allAppointments.length}</div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Projected Sales</div>
                    <div className="text-2xl font-bold text-slate-900">₱{calculateSales().toLocaleString()}</div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pending Requests</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {allAppointments.filter(a => a.status === 'pending').length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-8">
                {isCommandCenterLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-bold">Syncing Records...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                      <div>
                        <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          Appointment Registry
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full">Live</span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">Manage your patients and clinic schedule</p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <button 
                          onClick={() => setIsAddPatientOpen(true)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                          <Users className="w-4 h-4" />
                          Add New Patient
                        </button>
                        <div className="relative flex-1 md:w-64">
                          <input 
                            type="text" 
                            placeholder="Search patient..."
                            value={adminSearch}
                            onChange={(e) => setAdminSearch(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          />
                        </div>
                        <select 
                          value={adminFilter}
                          onChange={(e) => setAdminFilter(e.target.value as any)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        >
                          <option value="all">All Status</option>
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-separate border-spacing-y-3">
                        <thead>
                          <tr className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                            <th className="px-6 py-3">Patient</th>
                            <th className="px-6 py-3">Service</th>
                            <th className="px-6 py-3">Schedule</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAdminAppointments.length > 0 ? (
                            filteredAdminAppointments.map((apt) => (
                              <tr key={apt.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                                <td className="px-6 py-4 rounded-l-2xl">
                                  <div className="font-bold text-slate-900">{apt.name}</div>
                                  <div className="text-xs text-slate-500">{apt.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full uppercase">
                                    {apt.service}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-medium text-slate-700">{apt.date}</div>
                                  <div className="text-xs text-slate-400">{apt.slot}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                                    apt.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
                                    apt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {apt.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right rounded-r-2xl">
                                  {apt.status === 'pending' && (
                                    <div className="flex justify-end gap-2">
                                      <button 
                                        onClick={() => handleUpdateStatus(apt.id, 'confirmed')}
                                        className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all"
                                        title="Confirm Appointment"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => handleUpdateStatus(apt.id, 'cancelled')}
                                        className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"
                                        title="Cancel Appointment"
                                      >
                                        <Ban className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="text-center py-12 text-slate-400 italic">
                                No appointments found matching your criteria.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Patient Modal (Admin Only) */}
      <AnimatePresence>
        {isAddPatientOpen && isAdmin && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddPatientOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">Add New Patient</h3>
                <button onClick={() => setIsAddPatientOpen(false)}><X className="text-slate-400" /></button>
              </div>
              <form onSubmit={handleAddPatient} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={bookingData.name}
                    onChange={(e) => setBookingData({...bookingData, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                    <input 
                      required
                      type="email" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={bookingData.email}
                      onChange={(e) => setBookingData({...bookingData, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={bookingData.phone}
                      onChange={(e) => setBookingData({...bookingData, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Service</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={bookingData.service}
                    onChange={(e) => setBookingData({...bookingData, service: e.target.value})}
                  >
                    <option>General Checkup</option>
                    <option>Teeth Cleaning</option>
                    <option>Orthodontic Consultation</option>
                    <option>Dental Implant Inquiry</option>
                    <option>Teeth Whitening</option>
                    <option>Oral Surgery</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={bookingData.date}
                      onChange={(e) => setBookingData({...bookingData, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Time Slot</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. 09:00 AM"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={bookingData.slot}
                      onChange={(e) => setBookingData({...bookingData, slot: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                >
                  Save Patient Record
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Patient Portal Modal */}
      <AnimatePresence>
        {isPortalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPortalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Patient Portal</h3>
                    <p className="text-xs text-slate-500">Welcome back, {user?.displayName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPortalOpen(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto">
                {isPortalLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium">Fetching your history...</p>
                  </div>
                ) : userAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {userAppointments.map((apt) => (
                      <div key={apt.id} className="p-5 rounded-2xl border border-slate-100 bg-white hover:border-blue-200 transition-all group">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{apt.service}</span>
                            <h4 className="font-bold text-slate-900 mt-1">{apt.date} at {apt.slot}</h4>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                            apt.status === 'completed' ? 'bg-green-100 text-green-700' : 
                            apt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Booked on {apt.createdAt?.toDate ? apt.createdAt.toDate().toLocaleDateString() : 'Recently'}
                          </div>
                          {apt.reminderSent && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-3 h-3" />
                              Reminder Sent
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                      <Calendar className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-slate-900 mb-2">No appointments found</h4>
                    <p className="text-slate-500 text-sm mb-6">You haven't booked any appointments yet.</p>
                    <button 
                      onClick={() => { setIsPortalOpen(false); setIsBookingOpen(true); setBookingStep(1); }}
                      className="text-blue-600 font-bold text-sm flex items-center gap-2 mx-auto hover:gap-3 transition-all"
                    >
                      Book your first visit <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <div className="text-xs text-slate-500">
                  Logged in as <strong>{user?.email}</strong>
                </div>
                <button 
                  onClick={handleLogout}
                  className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" /> Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chatbot Interface */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 w-[90vw] sm:w-[400px] h-[600px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Chat Header */}
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold">Doc Gab</div>
                  <div className="text-xs text-blue-100 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Online Assistant
                  </div>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-tl-none'
                  }`}>
                    <div className="prose prose-sm prose-slate max-w-none">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-slate-100 bg-white">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask about our policies..."
                  className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-2">
                Doc Gab can only answer questions about clinic policies.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Chat Button */}
      {!isChatOpen && (
        <motion.button 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center group"
        >
          <MessageSquare className="w-7 h-7 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white">1</span>
        </motion.button>
      )}

      {/* Booking Modal */}
      <AnimatePresence>
        {isBookingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBookingOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="w-6 h-6" /> Book Appointment
                </h3>
                <button onClick={() => setIsBookingOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8">
                {bookingStep === 1 && (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <div className="w-16 h-1 bg-blue-100 rounded-full mx-auto mb-4 overflow-hidden">
                        <div className="w-1/4 h-full bg-blue-600"></div>
                      </div>
                      <p className="text-slate-600">Please provide your contact details to get started.</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          placeholder="John Doe"
                          value={bookingData.name}
                          onChange={(e) => setBookingData({...bookingData, name: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                          <input 
                            type="email" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="john@example.com"
                            value={bookingData.email}
                            onChange={(e) => setBookingData({...bookingData, email: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                          <input 
                            type="tel" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="0917-000-0000"
                            value={bookingData.phone}
                            onChange={(e) => setBookingData({...bookingData, phone: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setBookingStep(2)}
                      disabled={!bookingData.name || !bookingData.email || !bookingData.phone}
                      className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                      Next Step
                    </button>
                  </div>
                )}

                {bookingStep === 2 && (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <div className="w-16 h-1 bg-blue-100 rounded-full mx-auto mb-4 overflow-hidden">
                        <div className="w-2/4 h-full bg-blue-600"></div>
                      </div>
                      <p className="text-slate-600">Select your preferred service and date.</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Service</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          value={bookingData.service}
                          onChange={(e) => setBookingData({...bookingData, service: e.target.value})}
                        >
                          <option>General Checkup</option>
                          <option>Teeth Cleaning</option>
                          <option>Orthodontic Consultation</option>
                          <option>Dental Implant Inquiry</option>
                          <option>Teeth Whitening</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preferred Date</label>
                        <input 
                          type="date" 
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          value={bookingData.date}
                          onChange={(e) => setBookingData({...bookingData, date: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setBookingStep(1)}
                        className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all"
                      >
                        Back
                      </button>
                      <button 
                        onClick={() => setBookingStep(3)}
                        disabled={!bookingData.date}
                        className="flex-[2] bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                        Check Availability
                      </button>
                    </div>
                  </div>
                )}

                {bookingStep === 3 && (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <div className="w-16 h-1 bg-blue-100 rounded-full mx-auto mb-4 overflow-hidden">
                        <div className="w-3/4 h-full bg-blue-600"></div>
                      </div>
                      <p className="text-slate-600">Select an available time slot for {bookingData.date}.</p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {availableSlots.length > 0 ? (
                        availableSlots.map((slot) => (
                          <button
                            key={slot}
                            onClick={() => setBookingData({...bookingData, slot})}
                            className={`py-3 rounded-xl text-sm font-bold border transition-all ${
                              bookingData.slot === slot 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            {slot}
                          </button>
                        ))
                      ) : (
                        <div className="col-span-3 text-center py-8 text-slate-400 italic">
                          No slots available for this date. Please try another day.
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => setBookingStep(2)}
                        className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all"
                      >
                        Back
                      </button>
                      <button 
                        onClick={handleBookingSubmit}
                        disabled={!bookingData.slot}
                        className="flex-[2] bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                        Confirm Booking
                      </button>
                    </div>
                  </div>
                )}

                {bookingStep === 4 && (
                  <div className="text-center py-10">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h4 className="text-2xl font-bold mb-2">Booking Confirmed!</h4>
                    <p className="text-slate-600 mb-4">
                      Thank you, {bookingData.name.split(' ')[0]}. Your appointment for {bookingData.service} is confirmed for <strong>{bookingData.date}</strong> at <strong>{bookingData.slot}</strong>.
                    </p>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 flex items-center gap-3 text-left">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-blue-900">Automated Reminder Scheduled</p>
                        <p className="text-xs text-blue-700">You will receive an email reminder 24 hours before your appointment.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsBookingOpen(false)}
                      className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold hover:bg-slate-800 transition-all"
                    >
                      Close Window
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
