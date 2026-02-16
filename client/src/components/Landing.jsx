// import { Link } from "react-router-dom"
import React, { useState, useEffect, useContext } from 'react'
import { Carousel, Button, Modal } from 'react-bootstrap';


const Landing = (props) => {
  const [showAboutUs, setShowAboutUs] = useState(false);
  const handleCloseAboutUs = () => setShowAboutUs(false);
  const handleShowAboutUs = () => setShowAboutUs(true);

  const [showMMP, setShowMMP] = useState(false);
  const handleCloseMMP = () => setShowMMP(false);
  const handleShowMMP = () => setShowMMP(true);

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
      <Carousel>
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
      </Carousel>
      <div className="my-4 px-3">
        <Button className="fw-semibold" variant="secondary" onClick={handleShowAboutUs}>
          About Us
        </Button>
        <Modal show={showAboutUs} onHide={handleCloseAboutUs}>
          <Modal.Header closeButton>
            <Modal.Title>Why Choose American Legion Post 468 Catering</Modal.Title>
          </Modal.Header>
          <Modal.Body>American Legion Post 468 Catering brings together professional culinary experience, large-scale event expertise, and a deep commitment to serving our community.
            <br />
            Our program is led by a seasoned hospitality professional with extensive experience in fine dining, banquets, large-scale events, and full-service catering. From elegant weddings and plated dinners to high-volume community meals and crew catering, our team understands how to execute events smoothly, efficiently, and with attention to detail regardless of size or setting.
            <br />
            What sets us apart is the range of experience behind the scenes. Our leadership background includes years in fine-dining service, bartending, kitchen operations, banquet captain roles, and event coordination. This means we understand the elements that turn a meal into a successful event. Not only food, but timing, flow, guest experience, and logistics.
            <br />
            We operate out of a fully equipped commercial kitchen and work with a trained, reliable volunteer team, allowing us to scale from intimate gatherings to large events with confidence. Our menus are designed to be flexible and modular, offering everything from hearty, cost-effective meals for work crews and community events to thoughtfully composed menus for weddings and formal occasions.
            <br />
            Most importantly, every event we cater supports local veterans. As part of American Legion Post 468, proceeds from our catering services help fund outreach programs, community meals, and veteran support initiatives in Julian and the surrounding area. When you choose Legion Catering, you’re not just hiring a caterer, you’re investing in a program that gives back.</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseAboutUs}>
              Close
            </Button>
            {/* 
            <Button variant="primary" onClick={handleClose}>
              Save Changes
            </Button> 
            */}
          </Modal.Footer>
        </Modal>
      </div>
      <div className="my-4 px-3">
        <Button className="fw-semibold" variant="secondary" onClick={handleShowMMP}>
          Monday Meal Program
        </Button>
        <Modal show={showMMP} onHide={handleCloseMMP}>
          <Modal.Header closeButton>
            <Modal.Title>Our Monday Meal Program (<em>Comunity Impact</em>)</Modal.Title>
          </Modal.Header>
          <Modal.Body>The heart of our work begins every Monday.<br />
            American Legion Post 468’s Monday Meal Program was created to ensure that our local veterans are fed and taken care of.
            <br />
            Led by the same team behind our catering services, the program provides thoughtfully prepared meals using the Legion’s commercial kitchen, donated time, and community support. These meals are offered to veterans who may otherwise face gaps in food access due to limited mobility, fixed incomes, or lack of available services.
            <br />
            Our catering program helps make this possible. Revenue generated through events and food services directly supports the continuation and sustainability of the Monday Meal Program and other veteran-focused outreach efforts.</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseMMP}>
              Close
            </Button>
            {/* 
            <Button variant="primary" onClick={handleClose}>
              Save Changes
            </Button> 
            */}
          </Modal.Footer>
        </Modal>
      </div>

    </main>
  )
}
export default Landing;