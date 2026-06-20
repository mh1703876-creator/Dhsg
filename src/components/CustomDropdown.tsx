import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T> {
  value: T;
  label: string;
  sublabel?: string;
  group?: string;
}

interface CustomDropdownProps<T extends string> {
  id: string;
  value: T;
  onChange: (val: T) => void;
  options: DropdownOption<T>[];
  className?: string;
}

export default function CustomDropdown<T extends string>({
  id,
  value,
  onChange,
  options,
  className = ''
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeOption = options.find((opt) => opt.value === value) || options[0];

  // Group options if group exists
  const groups: { [key: string]: DropdownOption<T>[] } = {};
  const ungrouped: DropdownOption<T>[] = [];
  
  options.forEach((opt) => {
    if (opt.group) {
      if (!groups[opt.group]) {
        groups[opt.group] = [];
      }
      groups[opt.group].push(opt);
    } else {
      ungrouped.push(opt);
    }
  });

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
  };

  const renderOptionItem = (opt: DropdownOption<T>) => {
    const isSelected = opt.value === value;
    return (
      <button
        key={opt.value}
        type="button"
        onClick={() => handleSelect(opt.value)}
        className={`w-full text-left px-4 py-3 text-xs md:text-sm flex items-center justify-between transition-colors ${
          isSelected 
            ? 'bg-neutral-800 text-white font-medium' 
            : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
        }`}
        style={{ minHeight: '44px' }}
      >
        <div className="flex flex-col">
          <span>{opt.label}</span>
          {opt.sublabel && (
            <span className="text-[10px] text-neutral-500 mt-0.5">{opt.sublabel}</span>
          )}
        </div>
        {isSelected && <Check size={14} className="text-blue-500 ml-2 shrink-0" />}
      </button>
    );
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef} id={`dropdown-container-${id}`}>
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-neutral-900 border border-neutral-800 hover:border-neutral-700 active:border-neutral-600 rounded-lg py-2.5 px-3 text-neutral-200 text-xs md:text-sm transition-all focus:outline-none cursor-pointer"
        style={{ minHeight: '42px' }}
      >
        <span className="truncate">{activeOption ? activeOption.label : 'Select Option'}</span>
        <ChevronDown 
          size={16} 
          className={`text-neutral-500 transition-transform duration-200 ml-2 shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Options Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl py-1.5 z-50 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800">
          {ungrouped.map((opt) => renderOptionItem(opt))}

          {Object.keys(groups).map((groupName) => (
            <div key={groupName} className="border-t border-neutral-800/40 first:border-t-0 mt-1 pt-1">
              <div className="px-4 py-1 text-[10px] uppercase tracking-wider font-bold text-neutral-500 bg-neutral-950/20">
                {groupName}
              </div>
              {groups[groupName].map((opt) => renderOptionItem(opt))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
