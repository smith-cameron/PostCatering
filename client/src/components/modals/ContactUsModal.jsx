import InfoModal from "./InfoModal";

const ContactUsModal = ({ show, onHide }) => {
  return (
    <InfoModal show={show} onHide={onHide} title="Contact Us">
      <div className="info-modal-copy">
        <p className="lead">
          Use the public Post 468 contact details below for general questions and location information.
        </p>

        <p className="info-modal-section-title">Phone</p>
        <p>
          <a href="tel:7607650126">(760) 765-0126</a>
        </p>

        <p className="info-modal-section-title">Website / Contact Form</p>
        <p>
          <a href="https://www.lincolndemingpost468.org/" target="_blank" rel="noreferrer">
            lincolndemingpost468.org
          </a>
        </p>

        <p className="info-modal-section-title">Address</p>
        <p>
          American Legion Post 468
          <br />
          2503 Washington St
          <br />
          Julian, California 92036
        </p>

        <p className="info-modal-section-title">Catering Inquiries</p>
        <p className="mb-0">All catering inquiries should use the catering inquiry options provided on this site.</p>
      </div>
    </InfoModal>
  );
};

export default ContactUsModal;
