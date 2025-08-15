import React, { useState, useEffect } from 'react';
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
  alpha
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
  
  // Mouse olayları için state'ler
  // Ay durumlarını Firebase'den yükle
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

  // Rezervasyonları Firebase'den yükle
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
  }, []);

  // Ekran boyutu değiştiğinde hücre genişliğini güncelle
  useEffect(() => {
    const handleResize = () => {
      setCellWidth(calculateCellWidth());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  const handleMouseDown = (date, room) => {
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
  };

  const handleMouseEnter = (date, room) => {
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
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStartCell(null);
    setDragEndCell(null);
    setSelectionMode(null);
  };

  // useEffect for mouse up event
  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

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

  // Tarihin geçmiş tarih olup olmadığını kontrol eden fonksiyon
  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  // isDateBooked fonksiyonunu güncelle
  const isDateBooked = (date, room) => {
    if (isPastDate(date)) {
      return true;
    }
    const dateStr = date.toISOString().split('T')[0];
    return bookedDates[dateStr]?.rooms?.includes(room);
  };

  // Hücrenin seçili olup olmadığını kontrol et
  const isCellSelected = (date, room) => {
    return selectedCells.some(
      cell => 
        cell.date.toISOString().split('T')[0] === date.toISOString().split('T')[0] &&
        cell.room === room
    );
  };

  // Hücre rengi için fonksiyonu güncelle
  const getCellColor = (date, room) => {
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

  // Rezervasyon ekleme işleyicisini güncelle
  const handleAddReservation = async () => {
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
      for (const [dateStr, rooms] of Object.entries(groupedByDate)) {
        const docRef = doc(db, 'bookings', dateStr);
        const existingDoc = await getDoc(docRef);
        const existingRooms = existingDoc.exists() ? existingDoc.data().rooms || [] : [];
        
        await setDoc(docRef, {
          rooms: [...new Set([...existingRooms, ...rooms])],
          timestamp: serverTimestamp()
        });
      }
      
      setSelectedCells([]); // Seçimleri temizle
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
          const updatedRooms = existingRooms.filter(room => !roomsToDelete.includes(room));
          
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



  // Tek aylık tarih aralığını oluştur
  const dateRange = eachDayOfInterval({
    start: startDate,
    end: endOfMonth(addMonths(startDate, 1))
  });

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
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <IconButton 
              onClick={handlePrevMonth}
              disabled={isPrevMonthDisabled()}
              sx={{ 
                color: theme.palette.primary.main,
                '&.Mui-disabled': {
                  color: theme.palette.action.disabled
                },
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1)
                }
              }}
            >
              <ChevronLeftIcon />
            </IconButton>
            <Typography 
              variant="h6" 
              component="span"
              sx={{ 
                fontWeight: 600,
                color: theme.palette.primary.main,
                minWidth: '300px',
                textAlign: 'center'
              }}
            >
              {format(startDate, 'MMMM yyyy', { locale: tr })} - {format(addMonths(startDate, 1), 'MMMM yyyy', { locale: tr })}
            </Typography>
            <IconButton 
              onClick={handleNextMonth}
              sx={{ 
                color: theme.palette.primary.main,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1)
                }
              }}
            >
              <ChevronRightIcon />
            </IconButton>
            <Button 
              variant="outlined" 
              color="error" 
              onClick={handleLogout}
              sx={{ ml: 2 }}
            >
              Çıkış Yap
            </Button>
          </Box>
        </Box>

        {/* Month Availability Control Panel */}
        <Paper 
          elevation={2} 
          sx={{ 
            p: { xs: 2, sm: 3 },
            mb: { xs: 2, sm: 3 },
            backgroundColor: alpha(theme.palette.info.main, 0.05),
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
          }}
        >
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600,
              color: theme.palette.info.main,
              mb: 2,
              textAlign: 'center'
            }}
          >
            📅 Ay Bazlı Rezervasyon Kontrolü
          </Typography>
          
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'center'
          }}>
            {Array.from({ length: 12 }, (_, i) => {
              const date = addMonths(new Date(), i);
              const yearMonth = format(date, 'yyyy-MM');
              const isOpen = monthAvailability[yearMonth]?.isOpen !== false;
              
              return (
                <Box
                  key={yearMonth}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: isOpen 
                      ? alpha(theme.palette.success.main, 0.1)
                      : alpha(theme.palette.error.main, 0.1),
                    border: `2px solid ${isOpen 
                      ? theme.palette.success.main 
                      : theme.palette.error.main}`,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: theme.shadows[4]
                    }
                  }}
                  onClick={() => toggleMonthAvailability(yearMonth)}
                >
                  <Typography 
                    sx={{ 
                      fontWeight: 600,
                      color: isOpen 
                        ? theme.palette.success.main 
                        : theme.palette.error.main,
                      fontSize: { xs: '0.9rem', sm: '1rem' }
                    }}
                  >
                    {format(date, 'MMMM', { locale: tr })}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontSize: { xs: '0.7rem', sm: '0.8rem' },
                      color: theme.palette.text.secondary
                    }}
                  >
                    {format(date, 'yyyy')}
                  </Typography>
                  <Box sx={{
                    mt: 1,
                    px: 2,
                    py: 0.5,
                    borderRadius: 1,
                    backgroundColor: isOpen 
                      ? theme.palette.success.main 
                      : theme.palette.error.main,
                    color: 'white',
                    fontSize: { xs: '0.7rem', sm: '0.8rem' },
                    fontWeight: 600
                  }}>
                    {isOpen ? '✅ Açık' : '❌ Kapalı'}
                  </Box>
                </Box>
              );
            })}
          </Box>
          
          <Typography 
            variant="body2" 
            sx={{ 
              mt: 2,
              textAlign: 'center',
              color: theme.palette.text.secondary,
              fontSize: { xs: '0.75rem', sm: '0.8rem' }
            }}
          >
            💡 Aylara tıklayarak rezervasyon durumunu değiştirebilirsiniz. Kapalı aylar müşteri tarafında görünmez.
          </Typography>
        </Paper>

        <Box sx={{ mb: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleAddReservation}
            disabled={selectedCells.length === 0}
            sx={{ mr: 1 }}
          >
            Seçili Tarihleri Rezerve Et
          </Button>
          <Button 
            variant="outlined" 
            onClick={handleDeleteReservation}
            disabled={selectedCells.length === 0}
          >
            Seçili Tarihleri Sil
          </Button>
        </Box>
        
        <TableContainer 
          component={Paper}
          sx={{ 
            overflowX: 'auto',
            borderRadius: 2,
            boxShadow: theme.shadows[5],
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
          mt: { xs: 1, sm: 2 }
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
      </Box>
    </Container>
  );
}

export default AdminPanel; 