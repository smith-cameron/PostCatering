import InfoModal from "./InfoModal";

const AboutUsModal = ({ show, onHide }) => {
  return (
    <InfoModal show={show} onHide={onHide} title="Why Choose American Legion Post 468 Catering">
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

    </InfoModal>
  );
};

export default AboutUsModal;
