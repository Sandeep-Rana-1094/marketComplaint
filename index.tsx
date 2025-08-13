import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// --- TYPE DEFINITIONS ---
type Complaint = {
  id: string;
  plannedDate: string;
  step: string;
  stepCode: string;
  fullName: string;
  signature: string;
  contact: string;
  country: string;
  improvementPhotoUrl: string;
  statusLink: string;
  notes: string; // This is Complaint Type
  equipmentName: string;
  status: 'in-progress' | 'closed';
};

type SortKey = keyof Complaint;
type SortOrder = 'asc' | 'desc';
type Theme = 'light' | 'dark';


// --- HOOKS ---
const useCountUp = (endValue: number, duration: number = 1500) => {
    const [count, setCount] = useState(0);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        let startTime: number | null = null;
        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            const currentCount = Math.floor(percentage * endValue);
            setCount(currentCount);

            if (progress < duration) {
                rafRef.current = requestAnimationFrame(animate);
            } else {
                setCount(endValue); // Ensure it ends on the exact number
            }
        };
        rafRef.current = requestAnimationFrame(animate);
        
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [endValue, duration]);

    return count;
};

// --- UTILITY FUNCTIONS ---
const getStatus = (step: string): 'in-progress' | 'closed' => {
    if (!step) return 'in-progress';
    if (step.toLowerCase().includes('complete')) {
        return 'closed';
    }
    return 'in-progress';
};

const parseGoogleSheetCSV = (csvText: string): Complaint[] => {
    const lines = csvText.trim().split('\n');
    const dataLines = lines.slice(1);
    return dataLines.map(line => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, ''));
        if (cleanValues.length < 1 || !cleanValues[0]) return null;
        const step = cleanValues[3] || '';
        return {
            id: cleanValues[0] || '',
            plannedDate: cleanValues[1] || '',
            step: step,
            stepCode: cleanValues[5] || '',
            fullName: cleanValues[6] || '',
            signature: cleanValues[8] || '',
            contact: cleanValues[7] || '',
            country: cleanValues[9] || '',
            improvementPhotoUrl: cleanValues[10] || '',
            statusLink: cleanValues[11] || '',
            notes: cleanValues[14] || 'N/A',
            status: getStatus(step),
            equipmentName: cleanValues[15] || '',
        };
    }).filter((complaint): complaint is Complaint => complaint !== null && !!complaint.id);
};

const parseCompletedGoogleSheetCSV = (csvText: string): Complaint[] => {
    const lines = csvText.trim().split('\n');
    const dataLines = lines.slice(1);
    return dataLines.map(line => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, ''));
        if (cleanValues.length < 1 || !cleanValues[0]) return null;
        return {
            id: cleanValues[0] || '',
            fullName: cleanValues[1] || '',
            signature: cleanValues[2] || '',
            country: cleanValues[3] || '',
            equipmentName: cleanValues[4] || '',
            improvementPhotoUrl: cleanValues[5] || '',
            status: 'closed',
            // --- Fill in missing fields for unified type ---
            plannedDate: '',
            step: 'Closed',
            stepCode: '',
            contact: '',
            statusLink: '',
            notes: cleanValues[6] || 'N/A',
        };
    }).filter((complaint): complaint is Complaint => complaint !== null && !!complaint.id);
};


const parseDateString = (dateString: string): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (!isNaN(year) && year < 100) year += 2000;
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
        return date;
    }
    return null;
};

const getInitials = (name: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
}

const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

const toTitleCase = (str: string): string => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

// --- COMPONENTS ---

const ThemeSwitcher = ({ theme, toggleTheme, hasInProgress }: { theme: Theme; toggleTheme: () => void; hasInProgress: boolean; }) => (
    <button onClick={toggleTheme} className={`theme-switcher ${hasInProgress ? 'has-in-progress' : ''}`} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? (
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>
        )}
    </button>
);

const Header = ({ lastRefresh, theme, toggleTheme, inProgressCount }: { lastRefresh: Date | null; theme: Theme; toggleTheme: () => void; inProgressCount: number }) => (
    <header className="header">
        <div className="header-left">
             <a
                href="https://script.google.com/macros/s/AKfycbzc99fq49gpLSB7k8ZYyTcEvWIw44GsBXw_I5eAN7kdsFcHwEslF5x89jecBlhyzWVI/exec"
                target="_blank"
                rel="noopener noreferrer"
                className="add-complaint-button"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>Add New Complaint</span>
            </a>
        </div>
        <div className="header-center">
            <h1>Market Complaint Dashboard</h1>
            <p>Real-time tracking and management of market complaints.</p>
        </div>
        <div className="header-right">
            <div className="refresh-status">
                {lastRefresh ? `Last updated: ${lastRefresh.toLocaleTimeString()}`: 'Loading...'}
            </div>
            <ThemeSwitcher theme={theme} toggleTheme={toggleTheme} hasInProgress={inProgressCount > 0} />
        </div>
    </header>
);

const SummaryCard = ({ title, value, icon, onClick, selected }: { title: string; value: string | number; icon: React.ReactNode; onClick?: () => void; selected?: boolean; }) => (
    <div className={`card ${onClick ? 'clickable' : ''} ${selected ? 'selected' : ''}`} onClick={onClick}>
        <div className="card-icon">{icon}</div>
        <div className="card-content">
            <h2 className="card-title">{title}</h2>
            <p className="card-value">{value}</p>
        </div>
    </div>
);

const SummaryMetrics = ({ complaints, statusFilter, onStatusFilterChange }: { complaints: Complaint[]; statusFilter: string; onStatusFilterChange: (filter: 'all' | 'in-progress' | 'closed') => void; }) => {
    const totalComplaintsValue = complaints.length;
    const completedTasksValue = complaints.filter(c => c.status === 'closed').length;
    const inProgressTasks = totalComplaintsValue - completedTasksValue;
    
    const totalCount = useCountUp(totalComplaintsValue);
    const completedCount = useCountUp(completedTasksValue);
    const inProgressCount = useCountUp(inProgressTasks);

    return (
        <section className="summary-grid" aria-label="Dashboard Summary">
            <SummaryCard title="Total Complaints" value={totalCount} icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5.882,2H18.118a2,2,0,0,1,1.949,1.526L22,10.235V20a2,2,0,0,1-2,2H4a2,2,0,0,1-2-2V10.235L3.933,3.526A2,2,0,0,1,5.882,2ZM4,11.765V20H20V11.765l-1.933-6.441A.067.067,0,0,0,18.005,5.3H5.995a.067.067,0,0,0-.062.024L4,11.765ZM6.5,8a.5.5,0,0,1,0-1h11a.5.5,0,0,1,0,1H6.5Z"/></svg>} onClick={() => onStatusFilterChange('all')} selected={statusFilter === 'all'} />
            <SummaryCard title="In Progress" value={inProgressCount} icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Zm-1-8.59,4.29,4.3,1.41-1.42L11,10.41V5h-2v6.59Z"/></svg>} onClick={() => onStatusFilterChange('in-progress')} selected={statusFilter === 'in-progress'} />
            <SummaryCard title="Closed" value={completedCount} icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10,10-4.48,10-10S17.52,2,12,2Zm-2,15-5-5,1.41-1.41L10,14.17l7.59-7.59L19,8l-9,9Z"/></svg>} onClick={() => onStatusFilterChange('closed')} selected={statusFilter === 'closed'} />
        </section>
    );
};

const Avatar = ({ name }: { name: string }) => (
    <div className="avatar" style={{ backgroundColor: stringToColor(name) }}>
        {getInitials(name)}
    </div>
);

const TaskDetail = ({ task }: { task: Complaint }) => {
    const details = [
        { label: 'Complaint ID', value: task.id },
        { label: 'Step Code', value: task.stepCode },
        { label: 'Signature Provided', value: task.signature ? 'Yes' : 'No' },
        { label: 'Full Step Description', value: task.contact },
        { label: 'Complaint Type', value: task.notes },
        { label: 'Equipment/Machine', value: task.equipmentName },
    ];

    return (
        <div className="task-detail-grid">
            {details.filter(item => item.value && item.value !== 'N/A').map(item => (
                <div key={item.label} className="detail-item">
                    <span className="detail-item-label">{item.label}</span>
                    <span className="detail-item-value">{item.value}</span>
                </div>
            ))}
        </div>
    );
};

const TaskTable = ({ tasks, sortConfig, requestSort, expandedRowId, setExpandedRowId }: { tasks: Complaint[], sortConfig: {key: SortKey, order: SortOrder} | null, requestSort: (key: SortKey) => void, expandedRowId: string | null, setExpandedRowId: (id: string | null) => void }) => {
    
    const getSortIcon = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return '↕';
        return sortConfig.order === 'asc' ? '↑' : '↓';
    };

    const headers: { key: SortKey; label: string; }[] = [
      { key: 'id', label: 'Complaint ID' },
      { key: 'step', label: 'Status / Step' },
      { key: 'fullName', label: 'Submitted By' },
      { key: 'country', label: 'Country' },
      { key: 'notes', label: 'Complaint Type' },
      { key: 'equipmentName', label: 'Equipment/Machine' },
      { key: 'plannedDate', label: 'Planned Date' },
      { key: 'improvementPhotoUrl', label: 'Improvement' },
      { key: 'statusLink', label: 'Status Link' },
    ];

    const renderCellContent = (task: Complaint, key: SortKey) => {
        const value = task[key];
        switch (key) {
            case 'step': return <span className={`status ${task.status}`}>{value || 'N/A'}</span>;
            case 'fullName': return <div className="avatar-cell"><Avatar name={value as string} /><span>{value || 'N/A'}</span></div>;
            case 'plannedDate':
                if (!value) return 'N/A';
                const date = parseDateString(value as string);
                return date ? date.toLocaleDateString(undefined, { timeZone: 'UTC' }) : 'Invalid Date';
            case 'improvementPhotoUrl': {
                const url = value as string;
                return (url && url.toLowerCase().trim() !== 'na') ? <a href={url} target="_blank" rel="noopener noreferrer">View Document</a> : 'No Document';
            }
            case 'statusLink': {
                 const link = value as string;
                return (link && link.toLowerCase().trim() !== 'na') ? <a href={link} target="_blank" rel="noopener noreferrer">View Status</a> : 'N/A';
            }
            default: return value || 'N/A';
        }
    };
    
    return (
    <div className="table-container">
        <table>
            <thead>
                <tr>
                    <th className="chevron-cell" aria-label="Expand row"></th>
                    {headers.map(({key, label}) => (
                         <th key={key} data-column-key={key} onClick={() => requestSort(key)} className={`${sortConfig?.key === key ? 'sorted' : ''} ${key === 'fullName' || key === 'country' ? 'col-reduced-width' : ''}`.trim()}>
                           {label}
                           <span className="sort-icon">{getSortIcon(key)}</span>
                         </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {tasks.length > 0 ? tasks.map((task, index) => (
                    <React.Fragment key={task.id}>
                        <tr className="expandable-row animated-row" style={{animationDelay: `${index * 30}ms`}} onClick={() => setExpandedRowId(expandedRowId === task.id ? null : task.id)} data-expanded={expandedRowId === task.id}>
                            <td className="chevron-cell">
                                <svg className="chevron-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </td>
                            {headers.map(({ key }) => (
                                <td key={key} data-column-key={key} className={`${key === 'id' ? 'primary-text' : ''} ${key === 'fullName' || key === 'country' ? 'col-reduced-width' : ''}`.trim()} title={String(task[key] || '')}>
                                    {renderCellContent(task, key)}
                                </td>
                            ))}
                        </tr>
                        <tr className="detail-row" data-expanded={expandedRowId === task.id}>
                            <td colSpan={headers.length + 1} className="detail-cell">
                                <div className="detail-content-wrapper">
                                    <TaskDetail task={task} />
                                </div>
                            </td>
                        </tr>
                    </React.Fragment>
                )) : (
                    <tr>
                        <td colSpan={headers.length + 1} className="no-tasks-message">
                            No complaints found. Try adjusting your search or filter.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    </div>
    )
};


// --- MAIN APP COMPONENT ---
const App = () => {
  const [allComplaints, setAllComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedComplaintType, setSelectedComplaintType] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{key: SortKey, order: SortOrder} | null>({key: 'id', order: 'asc'});
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-progress' | 'closed'>('all');
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';
  });

  const fetchData = useCallback(async (isInitialLoad: boolean) => {
    const SHEET_ID = '1fmUWIqjjU1ftvIhddTtdjPEzylnj7C7ay0UremtPvZI';
    const SHEET_NAME = 'DB_Format';
    const TASKS_RANGE = 'A1:P';
    const COMPLETED_TASKS_RANGE = 'Q1:W';
    
    const TASKS_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}&range=${TASKS_RANGE}`;
    const COMPLETED_TASKS_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}&range=${COMPLETED_TASKS_RANGE}`;

    if (isInitialLoad) setLoading(true);
    else setIsRefreshing(true);
    
    try {
        const [tasksResponse, completedTasksResponse] = await Promise.all([
            fetch(TASKS_URL),
            fetch(COMPLETED_TASKS_URL)
        ]);

        if (!tasksResponse.ok) throw new Error(`Network response for tasks was not ok (${tasksResponse.status})`);
        if (!completedTasksResponse.ok) throw new Error(`Network response for completed tasks was not ok (${completedTasksResponse.status})`);
        
        const tasksCsvText = await tasksResponse.text();
        const completedCsvText = await completedTasksResponse.text();

        if (tasksCsvText.includes("gid must be a number")) throw new Error("Please check if the Google Sheet is public ('Anyone with the link can view').");
        
        const parsedTasks = parseGoogleSheetCSV(tasksCsvText);
        const parsedCompletedTasks = parseCompletedGoogleSheetCSV(completedCsvText);
        
        const taskIds = new Set(parsedTasks.map(t => t.id));
        const uniqueCompletedTasks = parsedCompletedTasks.filter(t => !taskIds.has(t.id));

        const combinedData = [...parsedTasks, ...uniqueCompletedTasks];
        setAllComplaints(combinedData);
        
        setLastRefresh(new Date());
        setError(null);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        if (isInitialLoad) setError(`Failed to fetch data. ${message}`);
        console.error(err);
    } finally {
        if (isInitialLoad) setLoading(false);
        setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    const intervalId = setInterval(() => fetchData(false), 60000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

   useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
            document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);
    
    useEffect(() => {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
      setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
    };

  const uniqueCountries = useMemo(() => {
    const countryNames = allComplaints.map(task => task.country).filter(Boolean);
    const normalizedCountries = new Set(countryNames.map(country => toTitleCase(country)));
    return Array.from(normalizedCountries).sort();
  }, [allComplaints]);

  const uniqueComplaintTypes = useMemo(() => {
    const complaintTypes = allComplaints.map(task => task.notes).filter(Boolean);
    const normalizedTypes = new Set(complaintTypes.map(type => toTitleCase(type)));
    return Array.from(normalizedTypes).sort();
  }, [allComplaints]);

  const inProgressCount = useMemo(() => allComplaints.filter(c => c.status === 'in-progress').length, [allComplaints]);

  const sortedTasks = useMemo(() => {
    let sorted = [...allComplaints];
    if (sortConfig !== null) {
        sorted.sort((a, b) => {
            const key = sortConfig.key;
            let valA: any = a[key] || '';
            let valB: any = b[key] || '';
            
            if (key === 'id') {
                const numA = parseInt(valA, 10);
                const numB = parseInt(valB, 10);
                // Treat non-numeric IDs as higher than numeric ones
                valA = isNaN(numA) ? Infinity : numA;
                valB = isNaN(numB) ? Infinity : numB;
            } else if (key === 'plannedDate') {
                const dateA = parseDateString(a.plannedDate);
                const dateB = parseDateString(b.plannedDate);
                if (dateA === null) return 1;
                if (dateB === null) return -1;
                valA = dateA.getTime();
                valB = dateB.getTime();
            }

            if (valA < valB) return sortConfig.order === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.order === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return sorted;
  }, [allComplaints, sortConfig]);

  const filteredTasks = useMemo(() => 
    sortedTasks.filter(task => {
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        const matchesCountry = !selectedCountry || toTitleCase(task.country) === selectedCountry;
        const matchesComplaintType = !selectedComplaintType || toTitleCase(task.notes || '') === selectedComplaintType;
        const matchesSearch = !searchTerm || Object.values(task).some(value =>
            String(value).toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchesStatus && matchesCountry && matchesComplaintType && matchesSearch;
    }
  ), [sortedTasks, searchTerm, selectedCountry, selectedComplaintType, statusFilter]);
  
  const tableKey = `${statusFilter}-${selectedCountry}-${selectedComplaintType}-${searchTerm}`;


  const requestSort = (key: SortKey) => {
    let order: SortOrder = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.order === 'asc') order = 'desc';
    setSortConfig({ key, order });
    setExpandedRowId(null);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCountry('');
    setSelectedComplaintType('');
    setExpandedRowId(null);
  };

  if (loading) {
    return <p className="loading-message">Loading dashboard from Google Sheet...</p>;
  }
  
  if (error) {
    return <p className="error-message">{error}</p>;
  }

  return (
    <>
      <Header lastRefresh={lastRefresh} theme={theme} toggleTheme={toggleTheme} inProgressCount={inProgressCount}/>
      <SummaryMetrics 
        complaints={allComplaints} 
        statusFilter={statusFilter}
        onStatusFilterChange={(filter) => {
            setStatusFilter(filter);
            setExpandedRowId(null);
        }} 
      />

      <main className="main-content">
        <div className="controls">
            <div className="search-input-wrapper">
                 <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input
                    type="text"
                    placeholder="Search all complaints..."
                    className="search-input"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setExpandedRowId(null);
                    }}
                    aria-label="Search complaints"
                />
            </div>

            <div className="filter-wrapper">
                <svg className="filter-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                <select
                    className="filter-select"
                    value={selectedCountry}
                    onChange={(e) => {
                        setSelectedCountry(e.target.value);
                        setExpandedRowId(null);
                    }}
                    aria-label="Filter by Country"
                >
                    <option value="">All Countries</option>
                    {uniqueCountries.map((country) => (
                        <option key={country} value={country}>
                            {country}
                        </option>
                    ))}
                </select>
            </div>

            <div className="filter-wrapper">
                <svg className="filter-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                <select
                    className="filter-select"
                    value={selectedComplaintType}
                    onChange={(e) => {
                        setSelectedComplaintType(e.target.value);
                        setExpandedRowId(null);
                    }}
                    aria-label="Filter by Complaint Type"
                >
                    <option value="">All Complaint Types</option>
                    {uniqueComplaintTypes.map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </select>
            </div>
            
            <button
                className="clear-filters-button"
                onClick={handleClearFilters}
                aria-label="Clear all filters"
                disabled={!searchTerm && !selectedCountry && !selectedComplaintType}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                <span>Clear Filters</span>
            </button>

            <button className={`refresh-button ${isRefreshing ? 'loading' : ''}`} onClick={() => fetchData(false)} disabled={isRefreshing}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
        </div>
        
        <TaskTable key={tableKey} tasks={filteredTasks} sortConfig={sortConfig} requestSort={requestSort} expandedRowId={expandedRowId} setExpandedRowId={setExpandedRowId} />
        
      </main>
    </>
  );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}