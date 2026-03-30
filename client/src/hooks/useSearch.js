import { useState } from 'react';

const useSearch = (initialSearchTerm = '') => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  return { searchTerm, handleSearchChange };
};

export default useSearch;
