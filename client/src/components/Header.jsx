// import { Link } from "react-router-dom"
// import React, { useState, useEffect, useContext } from 'react'
// import Context from '../context';

const Header = (props) => {
    // const {showForm, setShowForm} = useContext(Context);
    // const localContext = useContext(Context);

    return (
        <header>
            <nav class="navbar navbar-expand-lg navbar-dark bg-dark py-3">
                <div class="container">
                    {/* <!-- Brand --> */}
                    <h1><a class="navbar-brand fw-bold" href="#">AMERICAN LEGION POST 468</a></h1>

                    {/* <!-- Mobile toggle --> */}
                    <button
                        class="navbar-toggler"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#mainNavbar"
                        aria-controls="mainNavbar"
                        aria-expanded="false"
                        aria-label="Toggle navigation"
                    >
                        <span class="navbar-toggler-icon"></span>
                    </button>

                    {/* <!-- Nav links --> */}
                    {/* <div class="collapse navbar-collapse" id="mainNavbar">
                        <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
                            <li class="nav-item">
                                <a class="nav-link active" aria-current="page" href="#">Home</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="#">Services</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="#">About Us</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="#">Contact</a>
                            </li>
                        </ul>
                    </div> */}
                </div>
            </nav>
        </header>
    )
}
export default Header;