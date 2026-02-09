import React, { useState, useEffect, useContext } from 'react'
import { Header, Body, Footer } from '../imports'
import Context from '../context';

const Wrapper = (props) => {
    // const localContext = useContext(Context);

  return (
    <>
      
        <Header />
        <Body />
        <Footer />
        {/* Insert action component */}
      {/* </Context.Provider> */}
    </>
  )
}
export default Wrapper;