import InfoModal from "./InfoModal";

const MondayMealModal = ({ show, onHide }) => {
  return (
    <InfoModal show={show} onHide={onHide} title="Our Monday Meal Program" >
      <p>
        The heart of our work begins every Monday.
        <br />
        American Legion Post 468's Monday Meal Program was created to ensure that
        our local veterans are fed and taken care of.
      </p>

      <p>
        Led by the same team behind our catering services, the program provides
        thoughtfully prepared meals using the Legion's commercial kitchen, donated
        time, and community support. These meals are offered to veterans who may
        otherwise face gaps in food access due to limited mobility, fixed incomes,
        or lack of available services.
      </p>

      <p>
        Our catering program helps make this possible. Revenue generated through
        events and food services directly supports the continuation and
        sustainability of the Monday Meal Program and other veteran-focused
        outreach efforts.
      </p>

    </InfoModal>
  );
};

export default MondayMealModal;
