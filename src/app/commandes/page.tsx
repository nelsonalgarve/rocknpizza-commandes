'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import CommandeCard from '@/components/CommandeCard';

interface Commande {
  id: number;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  total: string;
  date_created: string;
  status: string;
  line_items: {
    name: string;
    quantity: number;
    total: string;
    total_tax: string;
  }[];
}

let cacheCommandes: Commande[] | null = null;
let cacheTimestamp = 0;

export default function CommandesPage() {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [hasProcessing, setHasProcessing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [perPage, setPerPage] = useState(100);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousIds = useRef<Set<number>>(new Set());
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('jwt');
    if (!token) {
      router.push('/login');
    } else {
      setHasMounted(true);
    }
  }, [router]);

  //   useEffect(() => {
  //     setHasMounted(true);
 
  // }, []);

  useEffect(() => {
    const fetchCommandes = async () => {
      const now = Date.now();
      if (cacheCommandes && now - cacheTimestamp < 30000) {
        setCommandes(cacheCommandes);
        const commandesProcessing = cacheCommandes.filter(c => c.status === 'processing');
        setHasProcessing(commandesProcessing.length > 0);
        previousIds.current = new Set(cacheCommandes.map(c => c.id));
        return;
      }

      try {
        const res = await fetch(`/api/commandes?status=any&per_page=${perPage}`);
        if (!res.ok) throw new Error('Erreur serveur');
        const data: Commande[] = await res.json();
        cacheCommandes = data;
        cacheTimestamp = now;
        const commandesProcessing = data.filter(c => c.status === 'processing');
        setHasProcessing(commandesProcessing.length > 0);
        previousIds.current = new Set(data.map(c => c.id));
        setCommandes(data);
      } catch (err) {
        console.error('Erreur chargement commandes:', err);
      }
    };

    fetchCommandes();
    const interval = setInterval(fetchCommandes, 15000);
    return () => clearInterval(interval);
  }, [perPage]);

  useEffect(() => {
    const soundInterval = setInterval(() => {
      if (hasProcessing && audioEnabled && audioRef.current && audioRef.current.paused) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((e) => console.warn('Échec lecture audio:', e));
      }
    }, 15000);
    return () => clearInterval(soundInterval);
  }, [hasProcessing, audioEnabled]);

  const updateCommande = async (id: number, updateData: Record<string, string>) => {
    try {
      const res = await fetch(`/api/commandes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      const updated = await res.json();
      setCommandes((prev) =>
        prev.map((cmd) => (cmd.id === id ? updated : cmd))
      );
      cacheCommandes = null;
    } catch (err) {
      console.error('Erreur MAJ commande :', err);
    }
  };

  const imprimerCommande = (commande: Commande) => {
    const content = `ROCK'N PIZZA\n\nCommande #${commande.id}\nDate : ${new Date(
      commande.date_created
    ).toLocaleString('fr-FR')}\n\nClient : ${commande.billing.first_name} ${commande.billing.last_name}\n📞 ${commande.billing.phone}\n📧 ${commande.billing.email}\n\nProduits :\n${commande.line_items
      .map((item) => {
        const ttc = (
          parseFloat(item.total) + parseFloat(item.total_tax)
        ).toFixed(2);
        return ` - ${item.quantity}× ${item.name} : ${ttc} €`;
      })
      .join('\n')}\n\nTotal : ${commande.total} €\n\nMerci et à bientôt !`;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write(`<pre style="font-size:16px">${content}</pre>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const logout = () => {
    localStorage.removeItem('jwt');
    router.push('/login');
  };

  if (!hasMounted) return null;

  const commandesFiltrees = filterDate
    ? commandes.filter(c => new Date(c.date_created).toISOString().slice(0, 10) === filterDate)
    : commandes;

  const commandesEnCours = commandesFiltrees.filter(c => c.status === 'processing');
  const commandesEnPreparation = commandesFiltrees.filter(c => c.status === 'preparation');
  const commandesTerminees = commandesFiltrees.filter(c => c.status === 'completed');

  return (
    <main className={darkMode ? 'dark bg-gray-900 min-h-screen p-4' : 'bg-gray-100 min-h-screen p-4'}>
      <audio ref={audioRef} src="/notif.mp3" preload="auto" />

      <header className="flex items-center justify-between mb-6 border-b pb-4 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="Rock'n Pizza" width={50} height={50} />
          <h1 className="text-2xl font-bold dark:text-white">Rock'n Pizza – Commandes</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="bg-black text-white px-3 py-2 rounded shadow"
          >
            🌓 {darkMode ? 'Clair' : 'Sombre'}
          </button>
          <button
            onClick={() => {
              if (!audioEnabled && audioRef.current) {
                audioRef.current.play().then(() => setAudioEnabled(true)).catch(e => console.warn('Audio refused:', e));
              } else {
                setAudioEnabled(false);
              }
            }}
            className={`px-3 py-2 rounded text-white shadow ${audioEnabled ? 'bg-red-600' : 'bg-blue-600'}`}
          >
            {audioEnabled ? '🔕 Son Off' : '🔔 Son On'}
          </button>
          <button
            onClick={logout}
            className="bg-gray-700 text-white px-3 py-2 rounded shadow hover:bg-gray-800"
          >
            🔓 Déconnexion
          </button>
        </div>
      </header>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Filtrer par date :</label>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2 border rounded-md shadow-sm w-full max-w-xs dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Nombre de commandes à afficher :</label>
        <select
          value={perPage}
          onChange={(e) => setPerPage(parseInt(e.target.value))}
          className="px-3 py-2 border rounded-md shadow-sm w-full max-w-xs dark:bg-gray-800 dark:text-white"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      <section className="space-y-12">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md border border-orange-400">
          <h2 className="text-2xl font-bold text-orange-600 mb-4 border-b border-orange-300 pb-2">🟠 Commandes confirmées ({commandesEnCours.length})</h2>
          <div className="flex flex-wrap gap-4 justify-start">
            {commandesEnCours.map(cmd => (
              <CommandeCard key={cmd.id} commande={cmd} onUpdate={updateCommande} onPrint={imprimerCommande} />
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md border border-yellow-400">
          <h2 className="text-2xl font-bold text-yellow-600 mb-4 border-b border-yellow-300 pb-2">🧑‍🍳 En préparation ({commandesEnPreparation.length})</h2>
          <div className="flex flex-wrap gap-4 justify-start">
            {commandesEnPreparation.map(cmd => (
              <CommandeCard key={cmd.id} commande={cmd} onUpdate={updateCommande} onPrint={imprimerCommande} />
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md border border-green-400">
          <h2 className="text-2xl font-bold text-green-600 mb-4 border-b border-green-300 pb-2">✅ Terminées ({commandesTerminees.length})</h2>
          <div className="flex flex-wrap gap-4 justify-start">
            {commandesTerminees.map(cmd => (
              <CommandeCard key={cmd.id} commande={cmd} onUpdate={updateCommande} onPrint={imprimerCommande} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
