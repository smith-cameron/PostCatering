import InfoModal from "./InfoModal";

const ContactUsModal = ({ show, onHide }) => {
  return (
    <InfoModal show={show} onHide={onHide} title="American Legion Post 468">
      <div className="info-modal-copy">
        <div className="contact-modal-inquiry-note">
          <p className="contact-modal-inquiry-title">Catering Inquiries</p>
          <p className="mb-2">
            If you&apos;re reaching out about food, menus, events, or anything catering-related,
            please use the inquiry options provided.
          </p>
          <p className="mb-0">
            For general questions, ask for our{" "}
            <span className="contact-modal-inquiry-contact">
              <span className="contact-modal-inquiry-contact-role">Events Coordinator</span>{" "}
              <span className="contact-modal-inquiry-contact-name">Arianne</span>
            </span>
            .
          </p>
        </div>

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
      </div>
    </InfoModal>
  );
};

export default ContactUsModal;
