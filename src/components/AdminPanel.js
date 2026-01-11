import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  useTheme,
  alpha,
  TextField,
  Stack,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider
} from '@mui/material';
import { collection, setDoc, doc, onSnapshot, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import { tr } from 'date-fns/locale';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const rooms = [
  'İnceburun',
  'Gökliman',
  'Armutlusu',
  'Çetisuyu',
  'İncirliin',
  'Hurmalıbük',
  'Kızılbük',
  'Değirmenbükü',
  'Yamaç ev',
  'İskaroz',
  'İskorpit',
  'Lopa'
];

function AdminPanel() {
  const theme = useTheme();
  const navigate = useNavigate();


  // Önce fonksiyonu tanımla
  const calculateCellWidth = () => {
    const containerWidth = window.innerWidth > 1200 ? 1200 : window.innerWidth - 48;
    const roomColumnWidth = 150;
    const remainingWidth = containerWidth - roomColumnWidth;
    const daysInMonth = 31;
    return Math.floor(remainingWidth / daysInMonth);
  };
  
  // Sonra state'leri tanımla
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return startOfMonth(today);
  });
  const [bookedDates, setBookedDates] = useState({});
  const [selectedCells, setSelectedCells] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartCell, setDragStartCell] = useState(null);
  const [dragEndCell, setDragEndCell] = useState(null);
  const [selectionMode, setSelectionMode] = useState(null);
  const [monthAvailability, setMonthAvailability] = useState({});
  const [cellWidth, setCellWidth] = useState(calculateCellWidth());
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [amountDue, setAmountDue] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [adultCount, setAdultCount] = useState(2);
  const [childCount, setChildCount] = useState(0);
  const [note, setNote] = useState('');

  // Rezervasyon listesi için state
  const [allReservations, setAllReservations] = useState({});

  const findBookingForCell = useCallback((date, room) => {
    const dateStr = date.toISOString().split('T')[0];
    const entry = bookedDates[dateStr];
    if (!entry || !Array.isArray(entry.rooms)) return null;
    const found = entry.rooms.find(item => {
      if (typeof item === 'string') return item === room;
      if (typeof item === 'object') return item?.room === room;
      return false;
    });
    if (!found) return null;
    if (typeof found === 'string') return { room: found };
    return found;
  }, [bookedDates]);

  const collectCellsForReservation = useCallback((reservationId) => {
    if (!reservationId) return [];
    const cells = [];

    Object.entries(bookedDates).forEach(([dateStr, data]) => {
      const date = new Date(dateStr);
      const roomsData = data?.rooms;
      if (Array.isArray(roomsData)) {
        roomsData.forEach(entry => {
          if (typeof entry === 'object' && entry?.reservationId === reservationId) {
            cells.push({
              date,
              room: entry.room
            });
          }
        });
      }
    });

    const uniqueKeys = new Set();
    const normalized = [];
    cells.forEach(cell => {
      const key = `${cell.room}-${cell.date.toISOString().split('T')[0]}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.add(key);
        normalized.push(cell);
      }
    });

    return normalized.sort((a, b) => {
      const dateA = a.date.toISOString();
      const dateB = b.date.toISOString();
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return rooms.indexOf(a.room) - rooms.indexOf(b.room);
    });
  }, [bookedDates]);

  const areSelectionsSame = useCallback((a, b) => {
    if (a.length !== b.length) return false;
    const makeKeySet = (arr) => new Set(
      arr.map(cell => `${cell.room}-${cell.date.toISOString().split('T')[0]}`)
    );
    const setA = makeKeySet(a);
    const setB = makeKeySet(b);
    if (setA.size !== setB.size) return false;
    for (const key of setA) {
      if (!setB.has(key)) return false;
    }
    return true;
  }, []);

  // Form verilerini hesapla - performans için memoized
  const formData = useMemo(() => {
    if (!selectedCells.length) {
      return {
        guestName: '',
        guestPhone: '',
        amountDue: '',
        amountPaid: '',
        paymentDate: '',
        adultCount: 2,
        childCount: 0,
        note: ''
      };
    }

    // Tarihe göre, sonra oda sırasına göre ilk hücreyi seç
    const sorted = [...selectedCells].sort((a, b) => {
      const dateA = a.date.toISOString();
      const dateB = b.date.toISOString();
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return rooms.indexOf(a.room) - rooms.indexOf(b.room);
    });
    const first = sorted[0];
    const existing = findBookingForCell(first.date, first.room);

    if (existing?.reservationId) {
      const relatedCells = collectCellsForReservation(existing.reservationId);
      return {
        existing,
        relatedCells,
        shouldUpdateSelection: relatedCells.length && !areSelectionsSame(selectedCells, relatedCells)
      };
    }

    return { existing };
  }, [selectedCells, findBookingForCell, collectCellsForReservation, areSelectionsSame]);

  // Local state for input values - performans için
  const [localGuestName, setLocalGuestName] = useState('');
  const [localGuestPhone, setLocalGuestPhone] = useState('');
  const [localAdultCount, setLocalAdultCount] = useState('2');
  const [localChildCount, setLocalChildCount] = useState('0');
  const [localAmountDue, setLocalAmountDue] = useState('');
  const [localAmountPaid, setLocalAmountPaid] = useState('');
  const [localPaymentDate, setLocalPaymentDate] = useState('');
  const [localNote, setLocalNote] = useState('');

  // Sync local state with form data on selection change
  useEffect(() => {
    setLocalGuestName(formData.existing?.guestName || '');
    setLocalGuestPhone(formData.existing?.guestPhone || '');
    setLocalAdultCount(String(formData.existing?.adultCount || 2));
    setLocalChildCount(String(formData.existing?.childCount || 0));
    setLocalAmountDue(formData.existing?.amountDue ? String(formData.existing.amountDue) : '');
    setLocalAmountPaid(formData.existing?.amountPaid ? String(formData.existing.amountPaid) : '');
    setLocalPaymentDate(formData.existing?.paymentDate || '');
    setLocalNote(formData.existing?.note || '');
  }, [formData.existing]);

  // Update global state only on blur - performans için
  const handleGuestNameBlur = useCallback(() => setGuestName(localGuestName), [localGuestName]);
  const handleGuestPhoneBlur = useCallback(() => setGuestPhone(localGuestPhone), [localGuestPhone]);
  const handleAdultCountBlur = useCallback(() => setAdultCount(Number(localAdultCount) || 2), [localAdultCount]);
  const handleChildCountBlur = useCallback(() => setChildCount(Number(localChildCount) || 0), [localChildCount]);
  const handleAmountDueBlur = useCallback(() => setAmountDue(localAmountDue ? Number(localAmountDue) : ''), [localAmountDue]);
  const handleAmountPaidBlur = useCallback(() => setAmountPaid(localAmountPaid ? Number(localAmountPaid) : ''), [localAmountPaid]);
  const handlePaymentDateBlur = useCallback(() => setPaymentDate(localPaymentDate), [localPaymentDate]);
  const handleNoteBlur = useCallback(() => setNote(localNote), [localNote]);

  // Rezervasyon listesi - createdAt'a göre sıralı (en yeni en üstte)
  const filteredReservations = useMemo(() => {
    const reservationMap = new Map();

    // Tüm rezervasyonları topla ve grupla
    Object.entries(allReservations).forEach(([dateStr, dayData]) => {
      if (dayData.rooms && Array.isArray(dayData.rooms)) {
        dayData.rooms.forEach(roomEntry => {
          if (typeof roomEntry === 'object' && roomEntry.reservationId) {
            const resId = roomEntry.reservationId;

            if (!reservationMap.has(resId)) {
              reservationMap.set(resId, {
                reservationId: resId,
                guestName: roomEntry.guestName,
                guestPhone: roomEntry.guestPhone,
                amountDue: roomEntry.amountDue,
                amountPaid: roomEntry.amountPaid,
                paymentDate: roomEntry.paymentDate,
                adultCount: roomEntry.adultCount,
                childCount: roomEntry.childCount,
                note: roomEntry.note,
                createdAt: roomEntry.createdAt,
                stayStart: roomEntry.stayStart,
                stayEnd: roomEntry.stayEnd,
                stayLengthDays: roomEntry.stayLengthDays,
                rooms: [roomEntry.room],
                bookingDates: [dateStr]
              });
            } else {
              const existing = reservationMap.get(resId);
              if (!existing.rooms.includes(roomEntry.room)) {
                existing.rooms.push(roomEntry.room);
              }
              if (!existing.bookingDates.includes(dateStr)) {
                existing.bookingDates.push(dateStr);
              }
            }
          }
        });
      }
    });

    // Map'i array'e çevir ve createdAt'a göre sırala (en yeni en üstte)
    const allBookings = Array.from(reservationMap.values());
    return allBookings.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
  }, [allReservations]);

  // Mouse olayları için state'ler



  // Ay durumlarını Firebase'den yükle - optimize edilmiş
  useEffect(() => {
    const availabilityRef = collection(db, 'monthAvailability');
    const unsubscribe = onSnapshot(availabilityRef, (snapshot) => {
      const availability = {};
      snapshot.forEach(doc => {
        availability[doc.id] = doc.data();
      });
      setMonthAvailability(availability);
    }, (error) => {
      console.error('Ay durumu dinleyicisinde hata:', error);
    });

    return () => unsubscribe();
  }, []); // Sadece mount'ta çalış

  // Tüm rezervasyonları çek - liste için
  useEffect(() => {
    const bookingsRef = collection(db, 'bookings');
    const unsubscribe = onSnapshot(bookingsRef, (snapshot) => {
      const bookings = {};
      snapshot.forEach(doc => {
        bookings[doc.id] = doc.data();
      });
      setAllReservations(bookings);
    }, (error) => {
      console.error('Rezervasyon listesi yüklenirken hata:', error);
    });

    return () => unsubscribe();
  }, []);

  // Ay durumunu değiştirme fonksiyonu
  const toggleMonthAvailability = async (yearMonth) => {
    try {
      const docRef = doc(db, 'monthAvailability', yearMonth);
      const currentStatus = monthAvailability[yearMonth]?.isOpen || false;
      
      await setDoc(docRef, {
        isOpen: !currentStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Ay durumu güncellenirken hata:', error);
    }
  };

  // Ayın açık olup olmadığını kontrol et
  const isMonthOpen = (date) => {
    const yearMonth = format(date, 'yyyy-MM');
    return monthAvailability[yearMonth]?.isOpen !== false; // Varsayılan olarak açık
  };

  // Rezervasyonları Firebase'den yükle - optimize edilmiş
  useEffect(() => {
    const bookingsRef = collection(db, 'bookings');
    const unsubscribe = onSnapshot(bookingsRef, (snapshot) => {
      const bookings = {};
      snapshot.forEach(doc => {
        bookings[doc.id] = doc.data();
      });
      setBookedDates(bookings);
    }, (error) => {
      console.error('Rezervasyon dinleyicisinde hata:', error);
    });

    return () => unsubscribe();
  }, []); // Sadece mount'ta çalış

  // Ekran boyutu değiştiğinde hücre genişliğini güncelle
  useEffect(() => {
    const handleResize = () => {
      setCellWidth(calculateCellWidth());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Tarihin geçmiş tarih olup olmadığını kontrol eden fonksiyon - optimize edilmiş
  const isPastDate = useCallback((date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  }, []); // Sadece date parametresine bağlı

  // isDateBooked fonksiyonunu güncelle - optimize edilmiş
  const isDateBooked = useCallback((date, room) => {
    if (isPastDate(date)) {
      return true;
    }
    const dateStr = date.toISOString().split('T')[0];
    const entry = bookedDates[dateStr];
    if (!entry) return false;
    // Eski veri yapısı desteği (string listesi) + yeni obje listesi
    if (Array.isArray(entry.rooms)) {
      return entry.rooms.some(item =>
        (typeof item === 'string' && item === room) ||
        (typeof item === 'object' && item?.room === room)
      );
    }
    return false;
  }, [bookedDates, isPastDate]); // isPastDate zaten memoized

  // Hücrenin seçili olup olmadığını kontrol et
  const isCellSelected = useCallback((date, room) => {
    return selectedCells.some(
      cell => 
        cell.date.toISOString().split('T')[0] === date.toISOString().split('T')[0] &&
        cell.room === room
    );
  }, [selectedCells]);

  // Hücre rengi için fonksiyonu güncelle - optimize edilmiş
  const getCellColor = useCallback((date, room) => {
    if (isPastDate(date)) {
      return alpha(theme.palette.grey[500], 0.9);
    }
    if (isCellSelected(date, room)) {
      return alpha(theme.palette.primary.main, 0.7);
    }
    if (isDateBooked(date, room)) {
      return alpha(theme.palette.error.main, 0.9);
    }
    if (isWeekend(date)) {
      return alpha(theme.palette.primary.main, 0.05);
    }
    return 'transparent';
  }, [isPastDate, isCellSelected, isDateBooked, theme]); // Tüm bağımlılıklar memoized

  // Hücre seçimi için yardımcı fonksiyonlar
  const isCellInRange = (date, room) => {
    if (!dragStartCell || !dragEndCell) return false;

    const startDate = new Date(dragStartCell.date);
    const endDate = new Date(dragEndCell.date);
    const currentDate = new Date(date);

    const isDateInRange = (
      currentDate >= (startDate < endDate ? startDate : endDate) &&
      currentDate <= (startDate < endDate ? endDate : startDate)
    );

    const roomIndex = rooms.indexOf(room);
    const startRoomIndex = rooms.indexOf(dragStartCell.room);
    const endRoomIndex = rooms.indexOf(dragEndCell.room);

    const isRoomInRange = (
      roomIndex >= Math.min(startRoomIndex, endRoomIndex) &&
      roomIndex <= Math.max(startRoomIndex, endRoomIndex)
    );

    return isDateInRange && isRoomInRange;
  };

  // Mouse event handlers
  const handleMouseDown = useCallback((date, room) => {
    if (isPastDate(date)) return;
    
    setIsDragging(true);
    setDragStartCell({ date, room });
    setDragEndCell({ date, room });
    
    // İlk tıklamada seçim modunu belirle
    const isAlreadySelected = selectedCells.some(
      cell => 
        cell.date.toISOString().split('T')[0] === date.toISOString().split('T')[0] &&
        cell.room === room
    );
    setSelectionMode(isAlreadySelected ? 'deselect' : 'select');
    
    // İlk hücreyi seç/kaldır
    setSelectedCells(prev => {
      if (isAlreadySelected) {
        return prev.filter(
          cell => 
            !(cell.date.toISOString().split('T')[0] === date.toISOString().split('T')[0] &&
            cell.room === room)
        );
      } else {
        return [...prev, { date, room }];
      }
    });
  }, [isPastDate, selectedCells]);

  const handleMouseEnter = useCallback((date, room) => {
    if (!isDragging || isPastDate(date)) return;
    
    setDragEndCell({ date, room });
    
    // Sürükleme sırasında hücreleri seç/kaldır
    const startDate = new Date(dragStartCell.date);
    const endDate = new Date(date);
    const startRoom = dragStartCell.room;
    const endRoom = room;
    
    const startRoomIndex = rooms.indexOf(startRoom);
    const endRoomIndex = rooms.indexOf(endRoom);
    const minRoomIndex = Math.min(startRoomIndex, endRoomIndex);
    const maxRoomIndex = Math.max(startRoomIndex, endRoomIndex);
    
    const minDate = startDate < endDate ? startDate : endDate;
    const maxDate = startDate < endDate ? endDate : startDate;
    
    setSelectedCells(prev => {
      let newSelection = [...prev];
      
      // Seçilen aralıktaki hücreleri işle
      const currentDate = new Date(minDate);
      while (currentDate <= maxDate) {
        for (let i = minRoomIndex; i <= maxRoomIndex; i++) {
          const currentRoom = rooms[i];
          if (!isPastDate(currentDate)) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const isCurrentlySelected = newSelection.some(
              cell => 
                cell.date.toISOString().split('T')[0] === dateStr &&
                cell.room === currentRoom
            );
            
            if (selectionMode === 'select' && !isCurrentlySelected) {
              newSelection.push({
                date: new Date(currentDate),
                room: currentRoom
              });
            } else if (selectionMode === 'deselect' && isCurrentlySelected) {
              newSelection = newSelection.filter(
                cell => 
                  !(cell.date.toISOString().split('T')[0] === dateStr &&
                  cell.room === currentRoom)
              );
            }
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return newSelection;
    });
  }, [isDragging, isPastDate, dragStartCell, selectionMode]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStartCell(null);
    setDragEndCell(null);
    setSelectionMode(null);
  }, []);

  // useEffect for mouse up event
  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);


  // TableCell render için
  const renderTableCell = (date, room) => (
    <TableCell 
      key={date.toISOString()}
      align="center"
      onMouseDown={() => handleMouseDown(date, room)}
      onMouseEnter={() => handleMouseEnter(date, room)}
      onMouseUp={handleMouseUp}
      sx={{
        backgroundColor: getCellColor(date, room),
        borderLeft: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
        width: { 
          xs: '35px', 
          sm: '45px',
          md: `${cellWidth}px`
        },
        cursor: isPastDate(date) ? 'not-allowed' : 'pointer',
        '&:hover': {
          backgroundColor: isPastDate(date)
            ? alpha(theme.palette.grey[500], 0.8)
            : isCellSelected(date, room)
              ? alpha(theme.palette.primary.main, 0.8)
              : alpha(theme.palette.primary.main, 0.1)
        },
        position: 'relative',
        transition: 'background-color 0.2s ease',
        userSelect: 'none' // Metin seçimini engelle
      }}
    >
      <Box sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {isPastDate(date) ? (
          <Typography sx={{ fontSize: '0.7rem', color: 'white', opacity: 0.7 }}>
            •
          </Typography>
        ) : isDateBooked(date, room) ? (
          <Typography sx={{ fontSize: '0.7rem', color: 'white' }}>
            •
          </Typography>
        ) : isCellSelected(date, room) ? (
          <Typography sx={{ fontSize: '0.7rem', color: 'white' }}>
            ✓
          </Typography>
        ) : null}
      </Box>
    </TableCell>
  );

  const handlePrevMonth = () => {
    setStartDate(date => {
      const newDate = addMonths(date, -1);
      // Geçmiş aya gitmeyi engelle
      if (isPastDate(endOfMonth(newDate))) {
        return date; // Eğer geçmiş aysa mevcut ayı koru
      }
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setStartDate(date => addMonths(date, 1));
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  // Hücre hover rengini belirleyen fonksiyon
  const getHoverColor = (date, room) => {
    if (isPastDate(date)) {
      return alpha(theme.palette.grey[500], 0.8);
    }
    if (isDateBooked(date, room)) {
      return alpha(theme.palette.error.main, 0.8);
    }
    return alpha(theme.palette.primary.main, 0.1);
  };

  // Önceki aya gitme butonunu devre dışı bırakma kontrolü
  const isPrevMonthDisabled = () => {
    const prevMonth = addMonths(startDate, -1);
    return isPastDate(endOfMonth(prevMonth));
  };

  // Hücre tıklama işleyicisini güncelle
  const handleCellClick = (date, room) => {
    if (isPastDate(date)) {
      return;
    }

    setSelectedCells(prev => {
      const isAlreadySelected = prev.some(
        cell => 
          cell.date.toISOString().split('T')[0] === date.toISOString().split('T')[0] &&
          cell.room === room
      );

      if (isAlreadySelected) {
        return prev.filter(
          cell => 
            !(cell.date.toISOString().split('T')[0] === date.toISOString().split('T')[0] &&
            cell.room === room)
        );
        } else {
        return [...prev, { date, room }];
      }
    });
  };

  const getCellKey = (cell) => `${cell.room}-${cell.date.toISOString().split('T')[0]}`;

  // Rezervasyon ekleme/güncelleme işleyicisi
  const handleAddReservation = async () => {
    if (selectedCells.length === 0) {
      alert('Lütfen önce tarih seçin');
      return;
    }

    if (!localGuestName.trim() || !localGuestPhone.trim()) {
      alert('Lütfen isim ve telefon bilgisini doldurun');
      return;
    }

    const initialCell = selectedCells[0];
    const existingForInitial = initialCell 
      ? findBookingForCell(initialCell.date, initialCell.room)
      : null;
    const existingReservationId = existingForInitial?.reservationId || null;
    const existingCreatedAt = existingForInitial?.createdAt || null;

    let cellsForUpdate = [...selectedCells];
    if (existingReservationId) {
      const reservationCells = collectCellsForReservation(existingReservationId);
      const reservationKeySet = new Set(reservationCells.map(getCellKey));
      const extraCells = selectedCells.filter(
        cell => !reservationKeySet.has(getCellKey(cell))
      );
      cellsForUpdate = [...reservationCells, ...extraCells];
    }

    // Blokaj tablosundan seçili olan tarihler (sadece selectedCells)
    const selectedDateStrings = [...new Set(
      selectedCells.map(cell => cell.date.toISOString().split('T')[0])
    )].sort();
    const uniqueDateStrings = [...new Set(
      cellsForUpdate.map(cell => cell.date.toISOString().split('T')[0])
    )].sort();

    // Blokaj tablosundan seçili tarihler her zaman giriş/çıkış için kullanılır
    // Benzersiz tarihleri al (çünkü aynı tarihte birden fazla oda seçilebilir)
    const uniqueDates = [...new Set(selectedCells.map(cell => {
      const cellDate = new Date(cell.date);
      return new Date(cellDate.getTime() - (cellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }))].sort();

    // İlk seçilen benzersiz tarih = Giriş tarihi
    const stayStart = uniqueDates[0];

    // Son seçilen benzersiz tarihten 1 gün sonrası = Çıkış tarihi
    const lastSelectedDate = uniqueDates[uniqueDates.length - 1];
    const stayEnd = new Date(new Date(lastSelectedDate).getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Benzersiz tarih sayısı = Gece sayısı
    const stayLengthDays = uniqueDates.length;


    console.log('stayStart:', stayStart);
    console.log('stayEnd:', stayEnd);
    console.log('stayLengthDays:', stayLengthDays);
    const reservationId = existingReservationId || `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const paymentDateValue = paymentDate ? paymentDate : null;
    const createdAt = existingCreatedAt || new Date().toISOString();

    try {
      // Seçili hücreleri tarihlere göre grupla
      const groupedByDate = cellsForUpdate.reduce((acc, cell) => {
        const dateStr = cell.date.toISOString().split('T')[0];
        if (!acc[dateStr]) {
          acc[dateStr] = [];
        }
        acc[dateStr].push(cell.room);
        return acc;
      }, {});

      // Her tarih için rezervasyonları güncelle
      for (const [dateStr, roomsForDate] of Object.entries(groupedByDate)) {
        const docRef = doc(db, 'bookings', dateStr);
        const existingDoc = await getDoc(docRef);
        const existingRooms = existingDoc.exists() ? existingDoc.data().rooms || [] : [];

        const newEntries = roomsForDate.map(room => {
          // Existing rezervasyon için değerleri koru, yeni değer varsa güncelle
          const existingAmountDue = existingReservationId && existingForInitial ? existingForInitial.amountDue : null;
          const existingAmountPaid = existingReservationId && existingForInitial ? existingForInitial.amountPaid : null;
          const existingPaymentDate = existingReservationId && existingForInitial ? existingForInitial.paymentDate : null;
          const existingAdultCount = existingReservationId && existingForInitial ? existingForInitial.adultCount : null;
          const existingChildCount = existingReservationId && existingForInitial ? existingForInitial.childCount : null;
          const existingNote = existingReservationId && existingForInitial ? existingForInitial.note : null;

          return {
            room,
            guestName: localGuestName.trim(),
            guestPhone: localGuestPhone.trim(),
            amountDue: localAmountDue ? Number(localAmountDue) : (existingAmountDue || 0),
            amountPaid: localAmountPaid ? Number(localAmountPaid) : (existingAmountPaid || 0),
            paymentDate: localPaymentDate || existingPaymentDate || null,
            adultCount: localAdultCount ? Number(localAdultCount) : (existingAdultCount || 2),
            childCount: localChildCount ? Number(localChildCount) : (existingChildCount || 0),
            note: localNote.trim() || (existingNote || ''),
            stayStart,
            stayEnd,
            stayLengthDays,
            reservationId,
            createdAt
          };
        });

        const updatedRooms = existingRooms.filter(entry => {
          const roomName = typeof entry === 'string' ? entry : entry.room;
          return !roomsForDate.includes(roomName);
        });

        await setDoc(docRef, {
          rooms: [...updatedRooms, ...newEntries],
          timestamp: serverTimestamp()
        }, { merge: true });
      }
      
      setSelectedCells([]); // Seçimleri temizle
      // Global state'leri temizle
      setGuestName('');
      setGuestPhone('');
      setAmountDue('');
      setAmountPaid('');
      setPaymentDate('');
      setAdultCount(2);
      setChildCount(0);
      setNote('');
      // Local state'leri temizle
      setLocalGuestName('');
      setLocalGuestPhone('');
      setLocalAdultCount('2');
      setLocalChildCount('0');
      setLocalAmountDue('');
      setLocalAmountPaid('');
      setLocalPaymentDate('');
      setLocalNote('');
    } catch (error) {
      console.error('Rezervasyon eklenirken hata:', error);
      alert('Rezervasyon eklenirken bir hata oluştu');
    }
  };

  // Rezervasyon silme işleyicisini güncelle
  const handleDeleteReservation = async () => {
    if (selectedCells.length === 0) {
      alert('Lütfen en az bir hücre seçin');
      return;
    }

    try {
      // Seçili hücreleri tarihlere göre grupla
      const groupedByDate = selectedCells.reduce((acc, cell) => {
        const dateStr = cell.date.toISOString().split('T')[0];
        if (!acc[dateStr]) {
          acc[dateStr] = [];
        }
        acc[dateStr].push(cell.room);
        return acc;
      }, {});

      // Her tarih için rezervasyonları güncelle
      for (const [dateStr, roomsToDelete] of Object.entries(groupedByDate)) {
        const docRef = doc(db, 'bookings', dateStr);
        const existingDoc = await getDoc(docRef);
        
        if (existingDoc.exists()) {
          const existingRooms = existingDoc.data().rooms || [];
          const updatedRooms = existingRooms.filter(roomEntry => {
            const roomName = typeof roomEntry === 'string' ? roomEntry : roomEntry.room;
            return !roomsToDelete.includes(roomName);
          });
          
          if (updatedRooms.length === 0) {
            await deleteDoc(docRef);
        } else {
            await setDoc(docRef, {
              rooms: updatedRooms,
              timestamp: serverTimestamp()
            });
          }
        }
      }
      
      setSelectedCells([]); // Seçimleri temizle
    } catch (error) {
      console.error('Rezervasyon silinirken hata:', error);
      alert('Rezervasyon silinirken bir hata oluştu');
    }
  };



  // 10 Şubat 2026 - 31 Mart 2026 tarih aralığını oluştur
  const dateRange = useMemo(() => eachDayOfInterval({
    start: new Date('2026-02-10'),
    end: new Date('2026-03-31')
  }), []);

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 2 }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
          borderRadius: 2,
          p: 2
        }}>
          <Typography variant="h4" sx={{ color: theme.palette.primary.main, fontWeight: 600 }}>
            🏠 Bizim Ev Datça - Admin Paneli
          </Typography>
          <Button
            variant="outlined"
            color="error"
            onClick={handleLogout}
          >
            Çıkış Yap
          </Button>
        </Box>


        {/* Rezervasyon Listesi */}
        <Paper
          elevation={2}
          sx={{
            p: 3,
            mb: 2,
            backgroundColor: alpha(theme.palette.success.main, 0.03),
            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
            borderRadius: 2
          }}
        >
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3
          }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: theme.palette.success.main,
                fontSize: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              🏨 Rezervasyon Listesi
              <Chip
                label={`${filteredReservations.length} rezervasyon`}
                size="small"
                color="success"
                sx={{ fontSize: '0.7rem' }}
              />
            </Typography>
          </Box>

          <Box sx={{
            maxHeight: '400px',
            overflow: 'auto',
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: alpha(theme.palette.divider, 0.1),
              borderRadius: '3px'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: alpha(theme.palette.primary.main, 0.3),
              borderRadius: '3px',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.5),
              }
            }
          }}>
            {filteredReservations.length === 0 ? (
              <Box sx={{
                textAlign: 'center',
                py: 4,
                color: 'text.secondary'
              }}>
                <Typography variant="h6" sx={{ mb: 1, opacity: 0.7 }}>
                  📭 Henüz rezervasyon yok
                </Typography>
                <Typography variant="body2">
                  İlk rezervasyonunuzu yapmak için takvimi kullanın.
                </Typography>
              </Box>
            ) : (
              filteredReservations.map((reservation, index) => (
                <Box
                  key={reservation.reservationId}
                  sx={{
                    mb: index < filteredReservations.length - 1 ? 2 : 0,
                    p: 2,
                    backgroundColor: 'background.paper',
                    borderRadius: 1,
                    border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.02),
                      borderColor: alpha(theme.palette.primary.main, 0.3)
                    }
                  }}
                >
                  {/* Üst kısım - İsim ve odalar */}
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 1.5
                  }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" sx={{
                        fontWeight: 600,
                        color: theme.palette.primary.main,
                        mb: 0.5
                      }}>
                        {reservation.guestName}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        📞 {reservation.guestPhone}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: '200px' }}>
                      {reservation.rooms.map((room, roomIndex) => (
                        <Chip
                          key={roomIndex}
                          label={room}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            height: '24px'
                          }}
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* Tarihler */}
                  <Box sx={{
                    display: 'flex',
                    gap: 2,
                    mb: 1.5,
                    flexWrap: 'wrap'
                  }}>
                    {reservation.stayStart && reservation.stayLengthDays && (
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        backgroundColor: alpha(theme.palette.info.main, 0.1),
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                      }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: theme.palette.info.main }}>
                          📅 {format(new Date(reservation.stayStart), 'dd.MM.yyyy', { locale: tr })}(Giriş) - {format(new Date(new Date(reservation.stayStart).getTime() + reservation.stayLengthDays * 24 * 60 * 60 * 1000), 'dd.MM.yyyy', { locale: tr })}(Çıkış)
                        </Typography>
                        <Chip
                          label={`${reservation.stayLengthDays} gece`}
                          size="small"
                          color="info"
                          sx={{ fontSize: '0.65rem', height: '20px' }}
                        />
                      </Box>
                    )}

                    {reservation.createdAt && reservation.createdAt.seconds && (
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: alpha(theme.palette.success.main, 0.1),
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
                      }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                          ✅ {(() => {
                            try {
                              return format(new Date(reservation.createdAt.seconds * 1000), 'dd.MM.yyyy HH:mm');
                            } catch (error) {
                              console.warn('Invalid createdAt timestamp in render:', reservation.createdAt);
                              return 'Tarih bilinmiyor';
                            }
                          })()}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Kişi sayısı ve tutarlar */}
                  {(reservation.adultCount > 0 || reservation.childCount > 0) && (
                    <Box sx={{
                      display: 'flex',
                      gap: 1,
                      mb: 1,
                      flexWrap: 'wrap'
                    }}>
                      {reservation.adultCount > 0 && (
                        <Chip
                          label={`👥 ${reservation.adultCount} yetişkin`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: '22px' }}
                        />
                      )}
                      {reservation.childCount > 0 && (
                        <Chip
                          label={`👶 ${reservation.childCount} çocuk`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: '22px' }}
                        />
                      )}
                      {reservation.amountDue > 0 && (
                        <Chip
                          label={`💰 Toplam: ${reservation.amountDue}₺`}
                          size="small"
                          color="warning"
                          sx={{ fontSize: '0.7rem', height: '22px' }}
                        />
                      )}
                      {reservation.amountPaid > 0 && (
                        <Chip
                          label={`✅ Ödenen: ${reservation.amountPaid}₺`}
                          size="small"
                          color="success"
                          sx={{ fontSize: '0.7rem', height: '22px' }}
                        />
                      )}
                      {reservation.paymentDate && (
                        <Chip
                          label={`📅 Ödeme: ${format(new Date(reservation.paymentDate), 'dd.MM.yyyy')}`}
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: '22px' }}
                        />
                      )}
                    </Box>
                  )}

                  {/* Not */}
                  {reservation.note && (
                    <Typography variant="body2" sx={{
                      color: 'text.secondary',
                      fontStyle: 'italic',
                      mt: 1,
                      p: 1,
                      backgroundColor: alpha(theme.palette.grey[500], 0.05),
                      borderRadius: 0.5,
                      borderLeft: `3px solid ${theme.palette.primary.main}`
                    }}>
                      📝 {reservation.note}
                    </Typography>
                  )}
                </Box>
              ))
            )}
          </Box>
        </Paper>

        {/* Tarih Aralığı Bilgisi */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          mb: 3,
          mt: 2,
          alignItems: 'center',
          gap: 2,
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
          borderRadius: 2,
          p: 2
        }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: theme.palette.primary.main,
              textAlign: 'center'
            }}
          >
            📅 10 Şubat 2026 - 31 Mart 2026 Tarih Aralığı
          </Typography>
        </Box>

        <TableContainer
          component={Paper}
          sx={{
            overflowX: 'auto',
            borderRadius: 2,
            boxShadow: theme.shadows[5],
            mb: 3,
            '&::-webkit-scrollbar': {
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: '#f1f1f1',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: alpha(theme.palette.primary.main, 0.3),
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.5),
              },
            },
          }}
        >
          <Table size="small" sx={{ tableLayout: 'fixed', minWidth: 'max-content' }}>
            <TableHead>
              <TableRow>
                <TableCell 
                  sx={{ 
                    width: '120px',
                    position: 'sticky', 
                    left: 0, 
                    backgroundColor: theme.palette.primary.main,
                    color: 'white',
                    zIndex: 3,
                    borderRight: `1px solid ${alpha(theme.palette.common.white, 0.2)}`
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Odalar
                  </Typography>
                </TableCell>
                {dateRange.map(date => (
                  <TableCell 
                    key={date.toISOString()} 
                    align="center"
                    sx={{ 
                      width: '45px',
                      backgroundColor: isWeekend(date) ? 
                        alpha(theme.palette.primary.main, 0.1) : 
                        theme.palette.background.paper,
                      fontWeight: 'bold',
                      p: '4px 2px',
                      fontSize: '0.75rem',
                      color: theme.palette.text.primary,
                      borderBottom: `2px solid ${theme.palette.primary.main}`
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {format(date, 'd')}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontSize: '0.65rem',
                          color: theme.palette.text.secondary,
                          mt: -0.5
                        }}
                      >
                        ({format(date, 'EEEEEE', { locale: tr })})
                      </Typography>
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rooms.map(room => (
                <TableRow 
                  key={room} 
                  hover
                  sx={{
                    '&:nth-of-type(odd)': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.02),
                    },
                  }}
                >
                  <TableCell 
                    component="th" 
                    scope="row"
                    sx={{ 
                      position: 'sticky', 
                      left: 0, 
                      backgroundColor: theme.palette.background.paper,
                      fontWeight: 600,
                      borderRight: `1px solid ${theme.palette.divider}`,
                      zIndex: 2,
                      fontSize: '0.8rem',
                      p: '4px 8px',
                      whiteSpace: 'nowrap',
                      color: theme.palette.primary.main
                    }}
                  >
                    {room}
                  </TableCell>
                  {dateRange.map(date => renderTableCell(date, room))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Legend */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: { xs: 2, sm: 4 },
          mt: { xs: 1, sm: 2 },
          mb: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: { xs: 12, sm: 16 },
              height: { xs: 12, sm: 16 },
              backgroundColor: alpha(theme.palette.error.main, 0.9),
              borderRadius: '50%'
            }} />
            <Typography variant="body2" color="text.secondary">
              Rezerve
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: { xs: 12, sm: 16 },
              height: { xs: 12, sm: 16 },
              backgroundColor: alpha(theme.palette.grey[500], 0.9),
              borderRadius: '50%'
            }} />
            <Typography variant="body2" color="text.secondary">
              Geçmiş Tarih
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: { xs: 12, sm: 16 },
              height: { xs: 12, sm: 16 },
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
              borderRadius: '50%'
            }} />
            <Typography variant="body2" color="text.secondary">
              Hafta Sonu
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: { xs: 12, sm: 16 },
              height: { xs: 12, sm: 16 },
              backgroundColor: alpha(theme.palette.primary.main, 0.7),
              borderRadius: '50%'
            }} />
            <Typography variant="body2" color="text.secondary">
              Seçili Tarihler
            </Typography>
          </Box>
        </Box>

        {/* Kişi Bilgileri Formu */}
        <Box sx={{ mb: 2 }}>
        <Paper
          elevation={1}
          sx={{
            p: 2,
            mb: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          {/* Kişi Bilgileri */}
          <Box sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: theme.palette.primary.main }}>
              👤 Kişi Bilgileri
            </Typography>
            <Stack direction="column" spacing={1.5}>
              <TextField
                label="İsim Soyisim"
                value={localGuestName}
                onChange={(e) => setLocalGuestName(e.target.value)}
                onBlur={handleGuestNameBlur}
                fullWidth
                required
                size="small"
                disabled={selectedCells.length === 0}
              />
              <TextField
                label="Telefon"
                value={localGuestPhone}
                onChange={(e) => setLocalGuestPhone(e.target.value)}
                onBlur={handleGuestPhoneBlur}
                fullWidth
                required
                size="small"
                disabled={selectedCells.length === 0}
              />
            </Stack>
          </Box>

          {/* Konuk Sayısı */}
          <Box sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: theme.palette.primary.main }}>
              👥 Konuk Sayısı
            </Typography>
            <Stack direction="column" spacing={1.5}>
              <TextField
                label="Yetişkin Sayısı"
                type="number"
                value={localAdultCount}
                onChange={(e) => setLocalAdultCount(e.target.value)}
                onBlur={handleAdultCountBlur}
                fullWidth
                inputProps={{ min: 0 }}
                size="small"
                disabled={selectedCells.length === 0}
              />
              <TextField
                label="Çocuk Sayısı"
                type="number"
                value={localChildCount}
                onChange={(e) => setLocalChildCount(e.target.value)}
                onBlur={handleChildCountBlur}
                fullWidth
                inputProps={{ min: 0 }}
                size="small"
                disabled={selectedCells.length === 0}
              />
            </Stack>
          </Box>

          {/* Ödeme Bilgileri */}
          <Box sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: theme.palette.primary.main }}>
              💰 Ödeme Bilgileri
            </Typography>
            <Stack direction="column" spacing={1.5}>
              <TextField
                label="Ödenecek Tutar"
                type="number"
                value={localAmountDue}
                onChange={(e) => setLocalAmountDue(e.target.value)}
                onBlur={handleAmountDueBlur}
                fullWidth
                inputProps={{ min: 0 }}
                size="small"
                disabled={selectedCells.length === 0}
              />
              <TextField
                label="Ödenen Tutar"
                type="number"
                value={localAmountPaid}
                onChange={(e) => setLocalAmountPaid(e.target.value)}
                onBlur={handleAmountPaidBlur}
                fullWidth
                inputProps={{ min: 0 }}
                size="small"
                disabled={selectedCells.length === 0}
              />
              <TextField
                label="Ödeme Tarihi"
                type="date"
                value={localPaymentDate}
                onChange={(e) => setLocalPaymentDate(e.target.value)}
                onBlur={handlePaymentDateBlur}
                fullWidth
                InputLabelProps={{ shrink: true }}
                size="small"
                disabled={selectedCells.length === 0}
              />
            </Stack>
          </Box>

          {/* Not */}
          <Box sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: theme.palette.primary.main }}>
              📝 Not
            </Typography>
            <TextField
              label="Not"
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              onBlur={handleNoteBlur}
              fullWidth
              multiline
              minRows={2}
              size="small"
              disabled={selectedCells.length === 0}
            />
          </Box>
        </Paper>

        {/* İşlem Butonları */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
          mt: 1,
          flexWrap: 'wrap'
        }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddReservation}
            disabled={selectedCells.length === 0}
            sx={{
              fontWeight: 600,
              '&:hover': {
                transform: 'scale(1.02)'
              },
              transition: 'transform 0.2s ease'
            }}
          >
            ✅ Rezerve Et
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDeleteReservation}
            disabled={selectedCells.length === 0}
            sx={{
              fontWeight: 600,
              '&:hover': {
                transform: 'scale(1.02)',
                backgroundColor: alpha(theme.palette.error.main, 0.05)
              },
              transition: 'all 0.2s ease'
            }}
          >
            🗑️ Sil
          </Button>
        </Box>
        </Box>
      </Box>
    </Container>
  );
}

export default AdminPanel; 