// import { Link } from "react-router-dom"
import React, { useState, useEffect, useContext } from 'react'
import { Carousel } from 'react-bootstrap';

const Landing = (props) => {
  return (
    <main className="landing-container text-center">
      {/* <h2
                className="text-center text-md-start"
            >
                Catering & Community Food Programs
            </h2> */}
      <h2>
        Food prepared with purpose
      </h2>
      <p>
        American Legion Post 468 Catering combines professional culinary and event experience with a mission to serve our community. <br /> Led by a hospitality professional with extensive fine-dining, banquet, and large-event background, our team delivers everything from casual community meals to elegant weddings with precision and care.<br /><strong>Every event supports local veterans through our ongoing meal programs and outreach initiatives.</strong>
      </p>
      {/* <Carousel>
        <Carousel.Item
          className='carousel-item'>
          <img
            className="d-block carousel-img"
            src="/imgs/homeslider3.jpg"
            alt="First slide"
          />
          <Carousel.Caption className="bg-dark bg-opacity-50 text-white p-3">
            <h3>First slide label</h3>
            <p>Nulla vitae elit libero, a pharetra augue mollis interdum.</p>
          </Carousel.Caption>
        </Carousel.Item>
        <Carousel.Item
          className='carousel-item'>
          <img
            className="d-block carousel-img"
            src="/imgs/gratisography-cut-the-cake-800x525.jpg"
            alt="Second slide"
          />
          <Carousel.Caption className="bg-dark bg-opacity-50 text-white p-3">
            <h3>Second slide label</h3>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
          </Carousel.Caption>
        </Carousel.Item>
        <Carousel.Item
          className='carousel-item'>
          <img
            className="d-block carousel-img"
            src="/imgs/gettyimages-1283712032-612x612.jpg"
            alt="Third slide"
          />
          <Carousel.Caption className="bg-dark bg-opacity-50 text-white p-3">
            <h3>Third slide label</h3>
            <p>
              Praesent commodo cursus magna, vel scelerisque nisl consectetur.
            </p>
          </Carousel.Caption>
        </Carousel.Item>
        <Carousel.Item
          className='carousel-item'>
          <img
            className="d-block carousel-img"
            src="/imgs/cooking-2132874_1280.jpg"
            alt="Fourth slide"
          />
          <Carousel.Caption className="bg-dark bg-opacity-50 text-white p-3">
            <h3>Fourth slide label</h3>
            <p>
              Suscipit architecto veritatis quae sit distinctio corporis beatae?.
            </p>
          </Carousel.Caption>
        </Carousel.Item>
        <Carousel.Item
          className='carousel-item'>
          <img
            className="d-block carousel-img"
            src="/imgs/closeup-spaghetti-meatballs-tomato-sauce-260nw-2468747773.jpg"

            alt="Fifth slide"
          />
          <Carousel.Caption className="bg-dark bg-opacity-50 text-white p-3">
            <h3>Fifth slide label</h3>
            <p>
              Eos, nisi sit, possimus maiores autem minima error eligendi repudiandae praesentium veritatis nam tempore modi vero maxime dolores perferendis aperiam? Necessitatibus, quas.
            </p>
          </Carousel.Caption>
        </Carousel.Item>
      </Carousel> */}
    </main>
  )
}
export default Landing;