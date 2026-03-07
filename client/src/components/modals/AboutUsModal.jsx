import InfoModal from "./InfoModal";

const AboutUsModal = ({ show, onHide }) => {
  return (
    <InfoModal show={show} onHide={onHide} title="Why Choose Post 468 Catering">
      {/*
        Legacy copy retained temporarily:
        <p>American Legion Post 468 Catering brings together professional culinary
          experience, large-scale event expertise, and a deep commitment to
          serving our community.
        </p>
        <p>
          Our program is led by a seasoned hospitality professional with extensive
          experience in fine dining, banquets, large-scale events, and full-service
          catering. From elegant weddings and plated dinners to high-volume
          community meals and crew catering, our team understands how to execute
          events smoothly, efficiently, and with attention to detail regardless of
          size or setting.
        </p>

        <p>
          What sets us apart is the range of experience behind the scenes. Our
          leadership background includes years in fine-dining service, bartending,
          kitchen operations, banquet captain roles, and event coordination. This
          means we understand the elements that turn a meal into a successful
          event, including timing, flow, guest experience, and logistics.
        </p>

        <p>
          We operate out of a fully equipped commercial kitchen and work with a
          trained, reliable volunteer team, allowing us to scale from intimate
          gatherings to large events with confidence. Our menus are designed to be
          flexible and modular, offering everything from hearty, cost-effective
          meals for work crews and community events to thoughtfully composed menus
          for weddings and formal occasions.
        </p>

        <p>
          Most importantly, every event we cater supports local veterans. As part
          of American Legion Post 468, proceeds from our catering services help
          fund outreach programs, community meals, and veteran support initiatives
          in Julian and the surrounding area. When you choose Legion Catering,
          you're not just hiring a caterer, you're investing in a program that
          gives back.
        </p>
      */}

      <div className="info-modal-copy">
        <p className="lead text-center">
          <strong>
            American Legion Post 468 Catering is built around a simple idea: great food can
            strengthen a community.
          </strong>
        </p>

        <p>
          Every meal we prepare supports programs that serve local veterans and bring people
          together across Julian and the surrounding area.
        </p>

        <p className="info-modal-section-title">Service With Purpose</p>
        <p>
          Our work goes beyond catering events. Proceeds from every service directly fund veteran
          outreach initiatives, community meals, and support programs through American Legion
          Post 468.
        </p>
        <p>
          Whether it&apos;s providing meals for those in need or supporting local gatherings, our
          mission is rooted in service.
        </p>

        <p className="info-modal-section-title">Built To Serve</p>
        <p>
          We design our menus to meet a wide range of community and event needs. From
          cost-effective, hearty meals for work crews and large community functions to
          thoughtfully prepared menus for weddings and formal occasions, our approach is
          flexible, scalable, and built to serve.
        </p>

        <p className="info-modal-section-title">How We Work</p>
        <p>
          Operating out of a fully equipped commercial kitchen and supported by a dependable
          volunteer team, we&apos;re able to execute events of all sizes while staying grounded in our
          purpose.
        </p>
        <p>Every event is an opportunity to deliver quality food while contributing to something larger.</p>

        <p className="text-center">
          <strong>
            When you choose Legion Catering, you&apos;re not just planning an event, you&apos;re helping
            sustain programs that directly benefit local veterans and the broader community.
          </strong>
        </p>
      </div>

    </InfoModal>
  );
};

export default AboutUsModal;
