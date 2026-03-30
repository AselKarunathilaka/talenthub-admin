import { useState } from 'react';

const usePagination = (initialPage = 1, initialItemsPerPage = 10) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

  const nextPage = () => {
    setCurrentPage((prevPage) => prevPage + 1);
  };

  const prevPage = () => {
    setCurrentPage((prevPage) => (prevPage > 1 ? prevPage - 1 : 1));
  };

  const setPage = (page) => {
    setCurrentPage(page);
  };

  const resetPagination = () => {
    setCurrentPage(initialPage);
    setItemsPerPage(initialItemsPerPage);
  };

  return { currentPage, itemsPerPage, nextPage, prevPage, setPage, resetPagination };
};

export default usePagination;
