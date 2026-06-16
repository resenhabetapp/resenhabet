import React, { useState, useRef, useEffect } from 'react';
import { FaFutbol, FaVolleyballBall, FaBasketballBall, FaFlagCheckered } from 'react-icons/fa';
import { GiTennisRacket } from 'react-icons/gi';
import { useTheme } from '../lib/ThemeContext';
import './SportSelector.css';

export interface Sport {
  id: string;
  name: string;
  icon: React.ElementType;
}

export const SPORTS: Sport[] = [
  { id: 'Futebol', name: 'Futebol', icon: FaFutbol },
  { id: 'Vôlei', name: 'Vôlei', icon: FaVolleyballBall },
  { id: 'Basquete', name: 'Basquete', icon: FaBasketballBall },
  { id: 'Tênis', name: 'Tênis', icon: GiTennisRacket },
  { id: 'Fórmula 1', name: 'Fórmula 1', icon: FaFlagCheckered },
];

const ITEM_WIDTH = 80;

interface SportSelectorProps {
  selectedSport?: string;
  onSelect?: (sport: Sport) => void;
}

export const SportSelector: React.FC<SportSelectorProps> = ({ selectedSport, onSelect }) => {
  const { theme } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitial = useRef(true);

  // Sync scroll position with external selectedSport prop on the X-axis
  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      if (selectedSport) {
        const index = SPORTS.findIndex((s) => s.id === selectedSport);
        if (index !== -1) {
          setActiveIndex(index);
          if (containerRef.current) {
            containerRef.current.scrollLeft = index * ITEM_WIDTH;
          }
        }
      }
      return;
    }

    if (selectedSport) {
      const index = SPORTS.findIndex((s) => s.id === selectedSport);
      if (index !== -1 && index !== activeIndex) {
        setActiveIndex(index);
        if (containerRef.current) {
          containerRef.current.scrollTo({
            left: index * ITEM_WIDTH,
            behavior: 'smooth',
          });
        }
      }
    }
  }, [selectedSport, activeIndex]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollLeft = containerRef.current.scrollLeft;
    
    // Calculate the index based on nearest item width slot
    const rawIndex = Math.round(scrollLeft / ITEM_WIDTH);
    const index = Math.max(0, Math.min(SPORTS.length - 1, rawIndex));

    if (index !== activeIndex) {
      setActiveIndex(index);
      if (onSelect) {
        onSelect(SPORTS[index]);
      }
    }
  };

  const handleItemClick = (index: number) => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      left: index * ITEM_WIDTH,
      behavior: 'smooth',
    });
  };

  return (
    <div 
      className={`wheel-container ${theme}`} 
      onScroll={handleScroll} 
      ref={containerRef}
      role="listbox"
      aria-label="Seletor de Esporte"
    >
      <div className="wheel-padding"></div>
      
      {SPORTS.map((sport, index) => {
        const Icon = sport.icon;
        const isActive = index === activeIndex;
        return (
          <div 
            key={sport.id}
            className={`wheel-item ${isActive ? 'active' : ''}`}
            onClick={() => handleItemClick(index)}
            title={sport.name}
            role="option"
            aria-selected={isActive}
          >
            <Icon size={24} />
            <span className="wheel-item-text">{sport.name}</span>
          </div>
        );
      })}
      
      <div className="wheel-padding"></div>
    </div>
  );
};
