export interface ContactLink {
  key: "instagram" | "whatsapp" | "phone-1" | "phone-2";
  label: string;
  /** Shown to the customer in the local 07xx form they recognise. */
  handle: string;
  /** Dialled/opened. Always the full international form — a 07xx tel: link
   *  fails for anyone roaming or calling from outside Iraq. */
  url: string;
}

export const CONTACT: { links: ContactLink[]; address: string; mapsUrl: string } = {
  address: "",
  mapsUrl: "",
  links: [
    {
      key: "instagram",
      label: "Instagram",
      handle: "@crownclub.erbil",
      url: "https://www.instagram.com/crownclub.erbil",
    },
    { key: "whatsapp", label: "WhatsApp", handle: "0750 243 8339", url: "https://wa.me/9647502438339" },
    { key: "phone-1", label: "Call", handle: "0750 243 8339", url: "tel:+9647502438339" },
    { key: "phone-2", label: "Call", handle: "0775 833 8339", url: "tel:+9647758338339" },
  ],
};
