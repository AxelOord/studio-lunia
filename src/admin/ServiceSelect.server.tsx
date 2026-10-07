import type { TextFieldServerComponent } from 'payload'
import { publishedServices } from '../inquiries/services'
import { ServiceSelect } from './ServiceSelect'

export const ServiceSelectField: TextFieldServerComponent = async ({ path, req, readOnly }) => (
  <ServiceSelect
    path={path}
    readOnly={readOnly}
    services={(await publishedServices(req.payload)).map(({ id, title }) => ({ id, title }))}
  />
)
